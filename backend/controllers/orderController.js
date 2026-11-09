import mongoose from "mongoose";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import foodModel from "../models/foodModel.js";
import { stripe } from "../config/stripe.js";
import {
  DELIVERY_FEE,
  INR_PER_USD,
  MAX_QTY_PER_ITEM,
  ORDER_STATUSES,
  ADDRESS_FIELDS,
} from "../config/constants.js";

const toCents = (dollars) => Math.round(dollars * 100);

// Marks an order as paid exactly once and empties that user's cart.
// Safe to call many times (webhook retries, verify page) - only the first call changes anything.
const markOrderPaid = async (orderId) => {
  const order = await orderModel.findOneAndUpdate(
    { _id: orderId, payment: false },
    { payment: true },
    { returnDocument: "after" },
  );
  if (order) {
    await userModel.findByIdAndUpdate(order.userId, { cartData: {} });
  }
  return Boolean(order);
};

// place a new order and start the Stripe payment
const placeOrder = async (req, res) => {
  // set FRONTEND_URL in the backend environment (your deployed frontend link)
  const frontend_url = (process.env.FRONTEND_URL || "http://localhost:5174").replace(/\/$/, "");

  try {
    const { userId, items, address } = req.body;

    // 1. delivery details must be complete (extra fields are dropped)
    if (
      !address ||
      ADDRESS_FIELDS.some(
        (field) => typeof address[field] !== "string" || !address[field].trim(),
      )
    ) {
      return res.json({
        success: false,
        message: "Please fill in all delivery details",
      });
    }
    const cleanAddress = Object.fromEntries(
      ADDRESS_FIELDS.map((field) => [field, address[field].trim()]),
    );

    // 2. from the browser we only accept WHICH dish and HOW MANY
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: "Your cart is empty" });
    }

    const quantities = new Map();
    for (const item of items) {
      const id = String(item?._id);
      const quantity = Number(item?.quantity);
      if (!mongoose.isValidObjectId(id) || !Number.isInteger(quantity) || quantity < 1) {
        return res.json({ success: false, message: "Invalid item in cart" });
      }
      quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
    if ([...quantities.values()].some((q) => q > MAX_QTY_PER_ITEM)) {
      return res.json({
        success: false,
        message: `You can order at most ${MAX_QTY_PER_ITEM} of one dish`,
      });
    }

    // 3. names and prices come from OUR database, never from the browser
    const foods = await foodModel.find({ _id: { $in: [...quantities.keys()] } });
    if (foods.length !== quantities.size) {
      return res.json({
        success: false,
        message: "Some items are no longer available",
      });
    }

    const orderItems = foods.map((food) => ({
      _id: food._id.toString(),
      name: food.name,
      price: food.price,
      quantity: quantities.get(food._id.toString()),
    }));

    const subtotalCents = orderItems.reduce(
      (sum, item) => sum + toCents(item.price) * item.quantity,
      0,
    );
    const amount = (subtotalCents + toCents(DELIVERY_FEE)) / 100;

    // 4. save the order as "not paid yet"
    const newOrder = await orderModel.create({
      userId,
      items: orderItems,
      amount,
      address: cleanAddress,
    });

    // 5. create the Stripe payment page
    try {
      const line_items = orderItems.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100 * INR_PER_USD),
        },
        quantity: item.quantity,
      }));

      line_items.push({
        price_data: {
          currency: "inr",
          product_data: { name: "Delivery Charges" },
          unit_amount: DELIVERY_FEE * 100 * INR_PER_USD,
        },
        quantity: 1,
      });

      const session = await stripe.checkout.sessions.create({
        line_items,
        mode: "payment",
        // the webhook uses these to know which order was paid
        metadata: { orderId: String(newOrder._id) },
        client_reference_id: String(newOrder._id),
        success_url: `${frontend_url}/verify?success=true&orderId=${newOrder._id}`,
        cancel_url: `${frontend_url}/verify?success=false&orderId=${newOrder._id}`,
      });

      newOrder.stripeSessionId = session.id;
      await newOrder.save();

      res.json({ success: true, session_url: session.url });
    } catch (stripeError) {
      // no payment page = no order, so we never keep half-created orders
      await orderModel.findByIdAndDelete(newOrder._id);
      throw stripeError;
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Could not start the payment" });
  }
};

// Stripe calls this URL itself after a payment (see app.js: it receives the RAW body).
// The signature proves the call really came from Stripe.
const stripeWebhook = async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.log("Webhook signature check failed:", error.message);
    return res.status(400).send("Webhook signature verification failed");
  }

  try {
    const session = event.data.object;
    const orderId = session?.metadata?.orderId;

    if (
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      session.payment_status === "paid" &&
      orderId
    ) {
      await markOrderPaid(orderId);
    }

    // checkout page expired without payment: remove the unpaid order
    if (event.type === "checkout.session.expired" && orderId) {
      await orderModel.deleteOne({ _id: orderId, payment: false });
    }

    res.json({ received: true });
  } catch (error) {
    console.log(error);
    // a 500 makes Stripe retry later
    res.status(500).send("Webhook handler failed");
  }
};

// Customer comes back from Stripe. We do NOT believe the browser: we ask Stripe.
const verifyOrder = async (req, res) => {
  const { userId, orderId } = req.body;
  try {
    if (!mongoose.isValidObjectId(orderId)) {
      return res.json({ success: false, message: "Order not found" });
    }

    // a customer can only verify their own order
    const order = await orderModel.findOne({ _id: orderId, userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (order.payment) {
      return res.json({ success: true, message: "Paid" });
    }
    if (!order.stripeSessionId) {
      return res.json({ success: false, message: "Not Paid" });
    }

    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

    if (session.payment_status === "paid") {
      await markOrderPaid(order._id);
      return res.json({ success: true, message: "Paid" });
    }

    await orderModel.deleteOne({ _id: order._id, payment: false });
    res.json({ success: false, message: "Not Paid" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// orders of the logged in customer (only paid ones are real orders)
const userOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({ userId: req.body.userId, payment: true })
      .sort({ date: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// all paid orders for the admin panel
const listOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({ payment: true }).sort({ date: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// admin changes the delivery status of an order
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!mongoose.isValidObjectId(orderId) || !ORDER_STATUSES.includes(status)) {
      return res.json({ success: false, message: "Invalid order or status" });
    }

    const order = await orderModel.findByIdAndUpdate(orderId, { status });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }
    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

export {
  placeOrder,
  stripeWebhook,
  verifyOrder,
  userOrders,
  listOrders,
  updateStatus,
};

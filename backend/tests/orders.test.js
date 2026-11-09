import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startApp, registerUser, createAdmin, address } from "./helpers.js";

describe("orders: server side prices and payment checks", () => {
  let ctx, stripe, foodModel, orderModel, userModel;
  let customer, other, admin, pizza, shake;
  let created; // what our fake Stripe received
  let stripeSession; // what our fake Stripe answers when asked about a session

  before(async () => {
    ctx = await startApp();
    ({ stripe } = await import("../config/stripe.js"));
    foodModel = (await import("../models/foodModel.js")).default;
    orderModel = (await import("../models/orderModel.js")).default;
    userModel = (await import("../models/userModel.js")).default;

    customer = await registerUser(ctx.app, "Customer", "c1@foodmate.test");
    other = await registerUser(ctx.app, "Other", "c2@foodmate.test");
    admin = await createAdmin(ctx.app);

    pizza = await foodModel.create({
      name: "Pizza", description: "cheesy", price: 10, image: "p.png", category: "Pasta",
    });
    shake = await foodModel.create({
      name: "Shake", description: "cold", price: 4.5, image: "s.png", category: "Deserts",
    });

    // fake Stripe: no network, we only record what the server asks for
    stripe.checkout.sessions.create = async (args) => {
      created = args;
      return { id: "cs_test_123", url: "https://checkout.stripe.test/pay" };
    };
    stripe.checkout.sessions.retrieve = async () => stripeSession;
  });
  after(() => ctx.stop());

  beforeEach(async () => {
    created = null;
    stripeSession = { payment_status: "unpaid" };
    await orderModel.deleteMany({});
    await userModel.findByIdAndUpdate(customer.id, { cartData: { [pizza._id]: 2 } });
  });

  const place = (body, token = customer.token) =>
    request(ctx.app).post("/api/order/place").set("token", token).send(body);

  describe("placing an order", () => {
    it("ignores prices, names and totals sent by the browser", async () => {
      const res = await place({
        address,
        amount: 0.01, // tampered total
        items: [{ _id: pizza._id, quantity: 2, price: 0.01, name: "Hacked" }],
      });

      assert.equal(res.body.success, true);
      assert.equal(res.body.session_url, "https://checkout.stripe.test/pay");

      const order = await orderModel.findOne({});
      assert.equal(order.amount, 22); // 2 x $10 + $2 delivery
      assert.equal(order.items[0].name, "Pizza");
      assert.equal(order.items[0].price, 10);
      assert.equal(order.payment, false);

      // Stripe was asked for the REAL price: $10 x 90 INR, in paise
      assert.equal(created.line_items[0].price_data.unit_amount, 10 * 100 * 90);
      assert.equal(created.line_items[0].quantity, 2);
      assert.equal(created.line_items[1].price_data.product_data.name, "Delivery Charges");
      assert.equal(created.metadata.orderId, order._id.toString());
    });

    it("handles decimal prices without rounding mistakes", async () => {
      const res = await place({
        address,
        items: [
          { _id: pizza._id, quantity: 1 },
          { _id: shake._id, quantity: 3 },
        ],
      });
      assert.equal(res.body.success, true);
      const order = await orderModel.findOne({});
      assert.equal(order.amount, 10 + 13.5 + 2);
      for (const line of created.line_items) {
        assert.ok(Number.isInteger(line.price_data.unit_amount), "Stripe needs whole numbers");
      }
    });

    it("merges the same dish sent twice", async () => {
      await place({
        address,
        items: [{ _id: pizza._id, quantity: 1 }, { _id: pizza._id, quantity: 2 }],
      });
      const order = await orderModel.findOne({});
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 3);
    });

    it("keeps only the known address fields", async () => {
      await place({
        address: { ...address, isAdmin: true },
        items: [{ _id: pizza._id, quantity: 1 }],
      });
      const order = await orderModel.findOne({});
      assert.equal(order.address.isAdmin, undefined);
      assert.equal(order.address.city, "Vijayawada");
    });

    const bad = [
      ["an empty cart", { items: [] }],
      ["no items at all", {}],
      ["quantity 0", { items: [{ _id: "PIZZA", quantity: 0 }] }],
      ["a negative quantity", { items: [{ _id: "PIZZA", quantity: -3 }] }],
      ["a fractional quantity", { items: [{ _id: "PIZZA", quantity: 1.5 }] }],
      ["a quantity above the limit", { items: [{ _id: "PIZZA", quantity: 51 }] }],
      ["an invalid dish id", { items: [{ _id: "not-an-id", quantity: 1 }] }],
      ["a dish that does not exist", { items: [{ _id: "64b64b64b64b64b64b64b64b", quantity: 1 }] }],
    ];
    for (const [name, body] of bad) {
      it(`rejects ${name}`, async () => {
        const items = body.items?.map((i) => ({ ...i, _id: i._id === "PIZZA" ? pizza._id : i._id }));
        const res = await place({ address, ...body, items });
        assert.equal(res.body.success, false);
        assert.equal(await orderModel.countDocuments(), 0);
        assert.equal(created, null, "Stripe must not be called for invalid orders");
      });
    }

    it("rejects missing delivery details", async () => {
      const { phone, ...incomplete } = address;
      const res = await place({ address: incomplete, items: [{ _id: pizza._id, quantity: 1 }] });
      assert.equal(res.body.success, false);
      assert.equal(await orderModel.countDocuments(), 0);
    });

    it("needs a logged in customer", async () => {
      const res = await request(ctx.app)
        .post("/api/order/place")
        .send({ address, items: [{ _id: pizza._id, quantity: 1 }] });
      assert.equal(res.body.code, "UNAUTHORIZED");
    });

    it("keeps the cart until the payment really succeeds", async () => {
      await place({ address, items: [{ _id: pizza._id, quantity: 2 }] });
      const user = await userModel.findById(customer.id);
      assert.equal(user.cartData[pizza._id], 2);
    });

    it("leaves no half-created order when Stripe fails", async () => {
      const original = stripe.checkout.sessions.create;
      stripe.checkout.sessions.create = async () => { throw new Error("stripe down"); };
      try {
        const res = await place({ address, items: [{ _id: pizza._id, quantity: 1 }] });
        assert.equal(res.body.success, false);
        assert.equal(await orderModel.countDocuments(), 0);
      } finally {
        stripe.checkout.sessions.create = original;
      }
    });
  });

  describe("verifying a payment after the Stripe redirect", () => {
    const makeOrder = (userId = customer.id, extra = {}) =>
      orderModel.create({
        userId, items: [{ _id: pizza._id.toString(), name: "Pizza", price: 10, quantity: 2 }],
        amount: 22, address, stripeSessionId: "cs_test_123", ...extra,
      });
    const verify = (orderId, token = customer.token, body = {}) =>
      request(ctx.app).post("/api/order/verify").set("token", token).send({ orderId, success: "true", ...body });

    it("does not trust success=true from the browser", async () => {
      const order = await makeOrder();
      stripeSession = { payment_status: "unpaid" };
      const res = await verify(order._id.toString());
      assert.equal(res.body.success, false);
      assert.equal(await orderModel.countDocuments({ _id: order._id }), 0, "unpaid order is removed");
    });

    it("marks the order paid and empties the cart when Stripe says paid", async () => {
      const order = await makeOrder();
      stripeSession = { payment_status: "paid" };
      const res = await verify(order._id.toString());
      assert.equal(res.body.success, true);

      assert.equal((await orderModel.findById(order._id)).payment, true);
      assert.deepEqual((await userModel.findById(customer.id)).cartData, {});
    });

    it("is safe to call twice", async () => {
      const order = await makeOrder();
      stripeSession = { payment_status: "paid" };
      await verify(order._id.toString());
      const again = await verify(order._id.toString());
      assert.equal(again.body.success, true);
    });

    it("stops one customer verifying (or deleting) another customer's order", async () => {
      const order = await makeOrder();
      const res = await verify(order._id.toString(), other.token);
      assert.equal(res.body.success, false);
      assert.equal(await orderModel.countDocuments({ _id: order._id }), 1, "order must survive");
    });

    it("needs a login and a valid order id", async () => {
      const noToken = await request(ctx.app).post("/api/order/verify").send({ orderId: "x" });
      assert.equal(noToken.body.code, "UNAUTHORIZED");
      const badId = await verify("not-an-id");
      assert.equal(badId.body.success, false);
    });
  });

  describe("order lists and status", () => {
    it("shows customers only their own PAID orders", async () => {
      await orderModel.create({ userId: customer.id, items: [], amount: 12, address, payment: true });
      await orderModel.create({ userId: customer.id, items: [], amount: 12, address, payment: false });
      await orderModel.create({ userId: other.id, items: [], amount: 12, address, payment: true });

      const res = await request(ctx.app).post("/api/order/userOrders").set("token", customer.token);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].payment, true);
    });

    it("shows the admin every paid order, newest first, and no unpaid ones", async () => {
      await orderModel.create({ userId: customer.id, items: [], amount: 1, address, payment: true, date: new Date("2026-01-01") });
      await orderModel.create({ userId: other.id, items: [], amount: 2, address, payment: true, date: new Date("2026-02-01") });
      await orderModel.create({ userId: other.id, items: [], amount: 3, address, payment: false });

      const res = await request(ctx.app).get("/api/order/list").set("token", admin.token);
      assert.deepEqual(res.body.data.map((o) => o.amount), [2, 1]);
    });

    it("lets the admin change the status to a known value only", async () => {
      const order = await orderModel.create({ userId: customer.id, items: [], amount: 5, address, payment: true });
      const set = (status) =>
        request(ctx.app).post("/api/order/status").set("token", admin.token).send({ orderId: order._id.toString(), status });

      assert.equal((await set("Out for Delivery")).body.success, true);
      assert.equal((await orderModel.findById(order._id)).status, "Out for Delivery");

      assert.equal((await set("Teleported to Mars")).body.success, false);
      assert.equal((await orderModel.findById(order._id)).status, "Out for Delivery");
    });
  });
});

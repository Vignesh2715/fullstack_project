import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startApp, registerUser, address } from "./helpers.js";

describe("Stripe webhook", () => {
  let ctx, stripe, orderModel, userModel, customer;

  before(async () => {
    ctx = await startApp();
    ({ stripe } = await import("../config/stripe.js"));
    orderModel = (await import("../models/orderModel.js")).default;
    userModel = (await import("../models/userModel.js")).default;
    customer = await registerUser(ctx.app, "Customer", "w1@foodmate.test");
  });
  after(() => ctx.stop());

  beforeEach(async () => {
    await orderModel.deleteMany({});
    await userModel.findByIdAndUpdate(customer.id, { cartData: { abc: 1 } });
  });

  const newOrder = () =>
    orderModel.create({ userId: customer.id, items: [], amount: 22, address, stripeSessionId: "cs_1" });

  // build a webhook call exactly like Stripe does: raw JSON + signature header
  const send = (event, secret = process.env.STRIPE_WEBHOOK_SECRET) => {
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return request(ctx.app)
      .post("/api/order/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", header)
      .send(payload);
  };
  const completed = (orderId, payment_status = "paid") => ({
    id: "evt_1", object: "event", type: "checkout.session.completed",
    data: { object: { id: "cs_1", payment_status, metadata: { orderId: String(orderId) } } },
  });

  it("rejects a call without a signature", async () => {
    const res = await request(ctx.app)
      .post("/api/order/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(completed("x")));
    assert.equal(res.status, 400);
  });

  it("rejects a call signed with the wrong secret (a fake Stripe)", async () => {
    const order = await newOrder();
    const res = await send(completed(order._id), "whsec_attacker_secret");
    assert.equal(res.status, 400);
    assert.equal((await orderModel.findById(order._id)).payment, false);
  });

  it("marks the order paid and empties the cart after a real payment", async () => {
    const order = await newOrder();
    const res = await send(completed(order._id));
    assert.equal(res.status, 200);
    assert.equal((await orderModel.findById(order._id)).payment, true);
    assert.deepEqual((await userModel.findById(customer.id)).cartData, {});
  });

  it("can be delivered twice without problems (Stripe retries)", async () => {
    const order = await newOrder();
    assert.equal((await send(completed(order._id))).status, 200);
    assert.equal((await send(completed(order._id))).status, 200);
    assert.equal((await orderModel.findById(order._id)).payment, true);
  });

  it("ignores a completed event that is not actually paid", async () => {
    const order = await newOrder();
    const res = await send(completed(order._id, "unpaid"));
    assert.equal(res.status, 200);
    assert.equal((await orderModel.findById(order._id)).payment, false);
  });

  it("removes an unpaid order when the checkout page expires", async () => {
    const order = await newOrder();
    await send({
      id: "evt_2", object: "event", type: "checkout.session.expired",
      data: { object: { id: "cs_1", metadata: { orderId: String(order._id) } } },
    });
    assert.equal(await orderModel.countDocuments({ _id: order._id }), 0);
  });

  it("never deletes an order that was already paid", async () => {
    const order = await orderModel.create({
      userId: customer.id, items: [], amount: 22, address, payment: true,
    });
    await send({
      id: "evt_3", object: "event", type: "checkout.session.expired",
      data: { object: { id: "cs_1", metadata: { orderId: String(order._id) } } },
    });
    assert.equal(await orderModel.countDocuments({ _id: order._id }), 1);
  });

  it("answers harmlessly to event types it does not care about", async () => {
    const res = await send({ id: "evt_4", object: "event", type: "customer.created", data: { object: {} } });
    assert.equal(res.status, 200);
  });
});

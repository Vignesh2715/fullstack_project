import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { startApp, registerUser, createAdmin } from "./helpers.js";

describe("authentication and admin access", () => {
  let ctx, customer, admin;

  before(async () => {
    ctx = await startApp();
    customer = await registerUser(ctx.app, "Customer", "customer@foodmate.test");
    admin = await createAdmin(ctx.app);
  });
  after(() => ctx.stop());

  describe("customer signup and login", () => {
    it("rejects a duplicate email", async () => {
      const res = await request(ctx.app)
        .post("/api/user/register")
        .send({ name: "Again", email: "customer@foodmate.test", password: "password123" });
      assert.equal(res.body.success, false);
    });

    it("rejects an invalid email and a short password", async () => {
      const badEmail = await request(ctx.app)
        .post("/api/user/register")
        .send({ name: "X", email: "not-an-email", password: "password123" });
      assert.equal(badEmail.body.success, false);

      const shortPass = await request(ctx.app)
        .post("/api/user/register")
        .send({ name: "X", email: "short@foodmate.test", password: "123" });
      assert.equal(shortPass.body.success, false);
    });

    it("logs in with the right password and refuses a wrong one", async () => {
      const ok = await request(ctx.app)
        .post("/api/user/login")
        .send({ email: "customer@foodmate.test", password: "password123" });
      assert.equal(ok.body.success, true);
      assert.ok(ok.body.token);

      const wrong = await request(ctx.app)
        .post("/api/user/login")
        .send({ email: "customer@foodmate.test", password: "wrong-password" });
      assert.equal(wrong.body.success, false);
    });

    it("issues tokens that expire", async () => {
      const decoded = jwt.decode(customer.token);
      assert.ok(decoded.exp, "token has no expiry");
    });
  });

  describe("protected customer routes", () => {
    it("refuses a request without a token", async () => {
      const res = await request(ctx.app).post("/api/cart/get");
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, "UNAUTHORIZED");
    });

    it("refuses a garbage token", async () => {
      const res = await request(ctx.app).post("/api/cart/get").set("token", "garbage");
      assert.equal(res.body.code, "UNAUTHORIZED");
    });

    it("refuses an expired token", async () => {
      const expired = jwt.sign({ id: customer.id }, process.env.JWT_SECRET, { expiresIn: -10 });
      const res = await request(ctx.app).post("/api/cart/get").set("token", expired);
      assert.equal(res.body.code, "UNAUTHORIZED");
      assert.match(res.body.message, /expired/i);
    });

    it("accepts a valid token", async () => {
      const res = await request(ctx.app).post("/api/cart/get").set("token", customer.token);
      assert.equal(res.body.success, true);
    });
  });

  describe("role based access (admin only routes)", () => {
    const adminRoutes = [
      ["post", "/api/food/add"],
      ["post", "/api/food/remove"],
      ["get", "/api/order/list"],
      ["post", "/api/order/status"],
    ];

    for (const [method, path] of adminRoutes) {
      it(`${method.toUpperCase()} ${path} needs a login`, async () => {
        const res = await request(ctx.app)[method](path);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, "UNAUTHORIZED");
      });

      it(`${method.toUpperCase()} ${path} refuses a normal customer`, async () => {
        const res = await request(ctx.app)[method](path).set("token", customer.token);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, "FORBIDDEN");
      });
    }

    it("the public menu list stays open to everyone", async () => {
      const res = await request(ctx.app).get("/api/food/list");
      assert.equal(res.body.success, true);
    });

    it("admin login refuses a customer account", async () => {
      const res = await request(ctx.app)
        .post("/api/user/admin/login")
        .send({ email: "customer@foodmate.test", password: "password123" });
      assert.equal(res.body.success, false);
      assert.equal(res.body.token, undefined);
    });

    it("admin login refuses a wrong password and an unknown email the same way", async () => {
      const wrong = await request(ctx.app)
        .post("/api/user/admin/login")
        .send({ email: admin.email, password: "nope-nope-nope" });
      const unknown = await request(ctx.app)
        .post("/api/user/admin/login")
        .send({ email: "ghost@foodmate.test", password: "whatever123" });
      assert.equal(wrong.body.message, unknown.body.message);
    });

    it("an admin can use admin routes", async () => {
      const res = await request(ctx.app).get("/api/order/list").set("token", admin.token);
      assert.equal(res.body.success, true);
    });

    it("removing the admin role blocks the old token immediately", async () => {
      const { default: userModel } = await import("../models/userModel.js");
      const temp = await createAdmin(ctx.app, "temp-admin@foodmate.test");

      const before = await request(ctx.app).get("/api/order/list").set("token", temp.token);
      assert.equal(before.body.success, true);

      await userModel.findByIdAndUpdate(temp.id, { role: "user" });

      const after = await request(ctx.app).get("/api/order/list").set("token", temp.token);
      assert.equal(after.body.code, "FORBIDDEN");
    });
  });
});

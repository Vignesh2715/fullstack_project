import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server-core";

// Starts the real Express app against a throw-away in-memory MongoDB.
// Nothing here ever touches your real database or the real Stripe.
export async function startApp() {
  process.env.JWT_SECRET = "test-secret";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
  process.env.FRONTEND_URL = "http://localhost:5174";

  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("food-mate-test");
  assert.ok(
    process.env.MONGO_URI.includes("127.0.0.1"),
    "tests must only use the local in-memory database",
  );

  const { default: app } = await import("../app.js");
  const { connectDB } = await import("../config/db.js");
  const { default: mongoose } = await import("mongoose");
  await connectDB();

  return {
    app,
    async stop() {
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

// register a customer through the real API and return { token, id }
export async function registerUser(app, name, email, password = "password123") {
  const res = await request(app)
    .post("/api/user/register")
    .send({ name, email, password });
  assert.equal(res.body.success, true, "test user could not be registered");
  const { default: userModel } = await import("../models/userModel.js");
  const user = await userModel.findOne({ email });
  return { token: res.body.token, id: user._id.toString() };
}

// create an admin directly in the database and log in through the admin endpoint
export async function createAdmin(app, email = "admin@foodmate.test", password = "adminpass123") {
  const { default: userModel } = await import("../models/userModel.js");
  const { default: bcrypt } = await import("bcrypt");
  const user = await userModel.create({
    name: "Admin",
    email,
    password: await bcrypt.hash(password, 10),
    role: "admin",
  });
  const res = await request(app).post("/api/user/admin/login").send({ email, password });
  assert.equal(res.body.success, true, "admin could not log in");
  return { token: res.body.token, id: user._id.toString(), email, password };
}

export const address = {
  firstName: "Asha",
  lastName: "Rao",
  email: "asha@example.com",
  street: "12 Main Road",
  city: "Vijayawada",
  state: "AP",
  zipcode: "520001",
  country: "India",
  phone: "9999999999",
};

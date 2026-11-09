// The Express app. server.js starts it; the tests import it directly.
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { stripeWebhook } from "./controllers/orderController.js";
dotenv.config();

const app = express();

app.use(cors());

// make sure the database is connected before every request
// (works on Vercel, where the server can pause between requests)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    // Stripe retries the webhook only when it gets a non-2xx answer
    const status = req.path === "/api/order/webhook" ? 503 : 200;
    res
      .status(status)
      .json({ success: false, message: "Database connection failed" });
  }
});

// Stripe webhook: must be registered BEFORE express.json(),
// because the signature check needs the untouched raw body.
app.post(
  "/api/order/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json());

// api end points
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads")); // only used for old local images
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);

app.get("/", (req, res) => {
  res.send("API WORKING");
});

// error handler (e.g. image too large) -> always answer with JSON
app.use((err, req, res, next) => {
  console.log(err);
  res.json({ success: false, message: err.message || "Error" });
});

export default app;

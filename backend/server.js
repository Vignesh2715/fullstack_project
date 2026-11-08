// ES-module based Express server (see "type": "module" in package.json)
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
dotenv.config();

// app config
const app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(express.json());
app.use(cors());

// db connection
// db connection: make sure the database is connected before every request
// (works on Vercel, where the server can pause between requests)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.json({ success: false, message: "Database connection failed" });
  }
});

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

// Vercel runs the exported app itself; only listen when running locally
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
  });
}

export default app;

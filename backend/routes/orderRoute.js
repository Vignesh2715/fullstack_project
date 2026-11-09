import express from "express";
import authMiddleware from "../middleware/auth.js";
import adminMiddleware from "../middleware/admin.js";
import {
  listOrders,
  placeOrder,
  updateStatus,
  userOrders,
  verifyOrder,
} from "../controllers/orderController.js";

// NOTE: the Stripe webhook route is registered in app.js (it needs the raw body)
const orderRouter = express.Router();

// customer
orderRouter.post("/place", authMiddleware, placeOrder);
orderRouter.post("/verify", authMiddleware, verifyOrder);
orderRouter.post("/userOrders", authMiddleware, userOrders);

// admin only
orderRouter.get("/list", adminMiddleware, listOrders);
orderRouter.post("/status", adminMiddleware, updateStatus);

export default orderRouter;

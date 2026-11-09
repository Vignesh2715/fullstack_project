import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

// Only users whose role is "admin" can pass.
// The role is read from the database on every request (not from the token),
// so removing someone's admin role takes effect immediately.
const adminMiddleware = async (req, res, next) => {
  const { token } = req.headers;

  if (!token) {
    return res.json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Admin login required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("role");

    if (!user || user.role !== "admin") {
      return res.json({
        success: false,
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    req.userId = decoded.id;
    next();
  } catch (error) {
    res.json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Session expired, please login again",
    });
  }
};

export default adminMiddleware;

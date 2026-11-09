import jwt from "jsonwebtoken";

// Login required. Sets req.userId (and req.body.userId for older controllers).
const authMiddleware = async (req, res, next) => {
  const { token } = req.headers;

  if (!token) {
    return res.json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Not Authorized Login Again",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.id;
    req.body = req.body || {};
    req.body.userId = decoded.id;

    next();
  } catch (error) {
    const expired = error.name === "TokenExpiredError";
    res.json({
      success: false,
      code: "UNAUTHORIZED",
      message: expired ? "Session expired, please login again" : "Invalid token",
    });
  }
};

export default authMiddleware;

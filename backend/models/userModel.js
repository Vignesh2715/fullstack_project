import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    cartData: { type: Object, default: {} },
    // "admin" can use the admin panel APIs, everybody else is a normal customer
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { minimize: false },
);
const userModel = mongoose.models.user || mongoose.model("user", userSchema);
export default userModel;

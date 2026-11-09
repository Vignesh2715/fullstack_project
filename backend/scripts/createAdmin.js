// Creates an admin user (or makes an existing user an admin).
//
// Run from the backend folder:
//   node scripts/createAdmin.js admin@example.com "YourStrongPassword" "Your Name"
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";

const [email, password, name = "Admin"] = process.argv.slice(2);

if (!email || !validator.isEmail(email) || !password || password.length < 8) {
  console.log('Usage: node scripts/createAdmin.js <email> "<password, min 8 chars>" ["Name"]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const existing = await userModel.findOne({ email });

if (existing) {
  existing.role = "admin";
  await existing.save();
  console.log(`${email} is now an admin (their password was not changed).`);
} else {
  const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));
  await userModel.create({ name, email, password: hashed, role: "admin" });
  console.log(`Admin created: ${email}`);
}

await mongoose.disconnect();

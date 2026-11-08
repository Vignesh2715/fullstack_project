// One-time script: uploads the old images from backend/uploads to Cloudinary
// and updates the food documents so they work on the deployed site.
//
// Run from the backend folder (needs MONGO_URI + CLOUDINARY_* in .env):
//   node scripts/migrateImagesToCloudinary.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import foodModel from "../models/foodModel.js";
import {
  isCloudinaryConfigured,
  uploadFileToCloudinary,
} from "../config/cloudinary.js";

if (!isCloudinaryConfigured()) {
  console.log("Set CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env first.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const foods = await foodModel.find({});
let moved = 0;

for (const food of foods) {
  if (food.image.startsWith("http")) continue; // already on Cloudinary

  const file = path.join("uploads", food.image);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${food.name}: ${file} not found`);
    continue;
  }

  const result = await uploadFileToCloudinary(file);
  food.image = result.secure_url;
  food.imageId = result.public_id;
  await food.save();
  moved++;
  console.log(`OK    ${food.name}`);
}

console.log(`Done. ${moved} image(s) moved to Cloudinary.`);
await mongoose.disconnect();

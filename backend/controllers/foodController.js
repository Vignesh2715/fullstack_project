import foodModel from "../models/foodModel.js";
import fs from "fs";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../config/cloudinary.js";

// add food item
const addFood = async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: "Image is required" });
    }

    let image;
    let imageId;

    if (isCloudinaryConfigured()) {
      const result = await uploadToCloudinary(req.file.buffer);
      image = result.secure_url;
      imageId = result.public_id;
    } else if (process.env.VERCEL) {
      return res.json({
        success: false,
        message: "Image storage (Cloudinary) is not configured on the server",
      });
    } else {
      image = req.file.filename;
    }

    const food = new foodModel({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      image,
      imageId,
    });

    await food.save();
    res.json({ success: true, message: "Food Added" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// all food lists
const listFood = async (req, res) => {
  try {
    const foods = await foodModel.find({});
    res.json({ success: true, data: foods });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// remove food item
const removeFood = async (req, res) => {
  try {
    const food = await foodModel.findById(req.body.id);
    if (!food) {
      return res.json({ success: false, message: "Food not found" });
    }

    if (food.imageId) {
      await deleteFromCloudinary(food.imageId).catch(() => {});
    } else if (!food.image.startsWith("http")) {
      fs.unlink(`uploads/${food.image}`, () => {});
    }

    await foodModel.findByIdAndDelete(req.body.id);
    res.json({ success: true, message: "Food Removed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

export { addFood, listFood, removeFood };

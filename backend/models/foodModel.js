import mongoose from "mongoose";

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  imageId: { type: String }, // Cloudinary public id (used to delete the image)
  category: { type: String, required: true },
});

const foodModel = mongoose.models.food || mongoose.model("food", foodSchema);

export default foodModel;

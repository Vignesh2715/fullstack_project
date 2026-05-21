import mongoose from "mongoose";

export const connectDB = async () => {
  await mongoose
    .connect(
      "mongodb+srv://madduri05:7013186280@cluster0.sa7oaku.mongodb.net/food-delivery",
    )
    .then(() => console.log("DB Connected"));
};

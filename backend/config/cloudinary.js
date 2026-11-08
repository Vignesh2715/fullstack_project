import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

// Image storage for deployed servers (Vercel has a read-only disk).
// If the 3 CLOUDINARY_* variables are not set, the app falls back to the
// local "uploads" folder, so local development keeps working as before.
export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );

const configure = () =>
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

export const uploadToCloudinary = (buffer) => {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "food-mate" },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
};

export const uploadFileToCloudinary = (filePath) => {
  configure();
  return cloudinary.uploader.upload(filePath, { folder: "food-mate" });
};

export const deleteFromCloudinary = (publicId) => {
  configure();
  return cloudinary.uploader.destroy(publicId);
};

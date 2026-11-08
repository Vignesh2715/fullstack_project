import express from "express";

import {
  addFood,
  listFood,
  removeFood,
} from "../controllers/foodController.js";
import multer from "multer";
import { isCloudinaryConfigured } from "../config/cloudinary.js";

const foodRouter = express.Router();

// image storage engine
// - Cloudinary configured (deployed): keep the file in memory, controller uploads it
// - otherwise (local development): save to the "uploads" folder
const storage = isCloudinaryConfigured()
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: "uploads",
      filename: (req, file, cb) => {
        return cb(null, `${Date.now()}${file.originalname}`);
      },
    });

const upload = multer({
  storage: storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB (Vercel request limit is 4.5 MB)
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

foodRouter.post("/add", upload.single("image"), addFood);
foodRouter.get("/list", listFood);
foodRouter.post("/remove", removeFood);

export default foodRouter;

// creating express server module based server we use es6 feature go to package.json and type=module
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import cartRouter from "./routes/cartRoute.js";
dotenv.config();

//app config

const app = express();
const port = 4000;

//middleware

app.use(express.json());
app.use(cors());

//db connection

connectDB();

// api end point
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);

app.get("/", (req, res) => {
  res.send("API WORKING");
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

//mongodb+srv://madduri05:7013186280@cluster0.sa7oaku.mongodb.net/?appName=Cluster0

import mongoose from "mongoose";

// Serverless-safe connection:
// - the connection is created on demand and reused between requests
// - a failed attempt is forgotten, so the next request tries again
let connecting = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return; // already connected

  if (!connecting) {
    connecting = mongoose
      .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 5,
      })
      .then(() => console.log("DB Connected"))
      .catch((error) => {
        connecting = null; // allow a retry on the next request
        console.log("DB connection failed:", error.message);
        throw error;
      });
  }

  await connecting;
};

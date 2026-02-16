import mongoose from "mongoose";
import { ENV } from "./env";

export const connectDB = async () => {
  const conn = await mongoose.connect(ENV.MONGO_URI);
  console.log(`✅ MongoDB: ${conn.connection.host}`);
};
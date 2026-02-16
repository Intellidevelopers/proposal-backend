import { connectDB } from "./config/db";
import { ENV } from "./config/env";
import app from "./app";

const start = async () => {
  try {
    await connectDB();
    app.listen(ENV.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${ENV.PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

start();
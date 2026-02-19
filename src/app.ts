import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generateLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import proposalRoutes from "./routes/proposalRoutes";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";

const app = express();

app.use(helmet());

const allowedOrigins = new Set([
  "https://proposal-hub-admin.vercel.app",
  "https://proposal-pro-ashen.vercel.app",
  "http://localhost:8081",
  "http://localhost:8080",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use("/api", generateLimiter);

app.use("/api/auth",      authRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/admin",     adminRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export default app;
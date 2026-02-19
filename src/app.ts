import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ENV } from "./config/env";
import { generateLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import proposalRoutes from "./routes/proposalRoutes";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";

const app = express();

app.use(helmet());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use("/api", generateLimiter);

app.use("/api/auth",      authRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/admin",     adminRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export default app;
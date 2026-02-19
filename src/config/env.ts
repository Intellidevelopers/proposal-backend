import dotenv from "dotenv";
dotenv.config();

["MONGO_URI", "JWT_SECRET"].forEach((k) => {
  if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
});

export const ENV = {
  PORT:             parseInt(process.env.PORT || "5000"),
  MONGO_URI:        process.env.MONGO_URI!,
  JWT_SECRET:       process.env.JWT_SECRET!,
  JWT_EXPIRES_IN:   process.env.JWT_EXPIRES_IN || "7d",
  COHERE_API_KEY:   process.env.COHERE_API_KEY || "",
  CLIENT_URL:       process.env.CLIENT_URL || "http://localhost:8080",
};
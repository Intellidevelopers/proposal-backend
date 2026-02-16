import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError)
    return res.status(err.statusCode).json({ success: false, message: err.message });
  if (err.code === 11000)
    return res.status(400).json({ success: false, message: "Email already in use." });
  if (err.name === "JsonWebTokenError")
    return res.status(401).json({ success: false, message: "Invalid token." });
  console.error(err);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
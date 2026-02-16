import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { ApiError } from "../utils/ApiError";
import User from "../models/User";

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const protect = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw new ApiError("Auth required.", 401);
    const decoded = jwt.verify(auth.split(" ")[1], ENV.JWT_SECRET) as any;
    if (!await User.findById(decoded.id)) throw new ApiError("User not found.", 401);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) { next(err); }
};
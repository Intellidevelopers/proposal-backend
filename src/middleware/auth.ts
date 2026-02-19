import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { ApiError } from "../utils/ApiError";
import User from "../models/User";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const protect = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      throw new ApiError("Auth required.", 401);

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      id: string;
    };

    const user = await User.findById(decoded.id);
    if (!user) throw new ApiError("User not found.", 401);

    // ✅ Now includes role
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
};


export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return next(new ApiError("Not authenticated.", 401));
  if (req.user.role !== "admin") return next(new ApiError("Admin access required.", 403));
  next();
};
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { ENV } from "../config/env";
import { ApiError } from "../utils/ApiError";

const sign = (id: string, email: string) =>
  jwt.sign({ id, email }, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES_IN } as any);

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) throw new ApiError("All fields required.", 400);
    const user  = await User.create({ name, email, password });
    res.status(201).json({ success: true, token: sign(String(user._id), user.email), user });
  } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      throw new ApiError("Invalid credentials.", 401);
    res.json({ success: true, token: sign(String(user._id), user.email), user });
  } catch (err) { next(err); }
};
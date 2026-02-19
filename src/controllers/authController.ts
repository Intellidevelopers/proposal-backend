import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { ENV } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { getClientIp, getCountryFromIp } from "../utils/geoip";

const sign = (id: string, email: string) =>
  jwt.sign({ id, email }, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES_IN } as any);

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      throw new ApiError("All fields required.", 400);

    const exists = await User.findOne({ email });
    if (exists) throw new ApiError("Email already in use.", 409);

    const ip      = getClientIp(req);
    const country = await getCountryFromIp(ip);

    const user = await User.create({
      name,
      email,
      password,
      role: "user",
      country,          // ← pass it in here
    });

    res.status(201).json({
      success: true,
      token: sign(String(user._id), user.email),
      user,
    });
  } catch (err) {
    next(err);
  }
};


export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      throw new ApiError("Invalid credentials.", 401);

    // Backfill: silently update country on first login after the field was added
    if (!user.country) {
      const ip      = getClientIp(req);
      const country = await getCountryFromIp(ip);
      if (country) {
        user.country = country;
        await user.save({ validateBeforeSave: false });
      }
    }

    res.json({ success: true, token: sign(String(user._id), user.email), user });
  } catch (err) { next(err); }
};
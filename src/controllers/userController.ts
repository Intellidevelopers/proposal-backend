import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import User from "../models/User";
import { ApiError } from "../utils/ApiError";

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) throw new ApiError("User not found.", 404);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(req.user!.id, { name, email }, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// NEW: Check if user has an API key saved (without exposing the key itself)
export const getApiKeyStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.id).select("+cohereApiKey");
    if (!user) throw new ApiError("User not found.", 404);

    const hasApiKey = !!(user.cohereApiKey && user.cohereApiKey.length > 0);

    res.json({
      success: true,
      hasApiKey,
      // Optionally, return first/last few characters for verification
      keyPreview: hasApiKey ? `${user.cohereApiKey.slice(0, 4)}...${user.cohereApiKey.slice(-4)}` : null,
    });
  } catch (err) {
    next(err);
  }
};

export const updateApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cohereApiKey } = req.body;

    if (cohereApiKey !== undefined && typeof cohereApiKey !== "string") {
      throw new ApiError("Invalid API key format.", 400);
    }

    await User.findByIdAndUpdate(req.user!.id, { cohereApiKey: cohereApiKey || "" });
    res.json({ success: true, message: "Cohere API key saved." });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new ApiError("Both passwords required.", 400);
    if (newPassword.length < 6) throw new ApiError("New password must be 6+ characters.", 400);

    const user = await User.findById(req.user!.id).select("+password");
    if (!user || !(await user.comparePassword(currentPassword)))
      throw new ApiError("Current password is incorrect.", 401);

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "Password updated." });
  } catch (err) {
    next(err);
  }
};
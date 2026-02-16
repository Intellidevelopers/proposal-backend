import { Router } from "express";
import {
  getMe,
  updateProfile,
  getApiKeyStatus,
  updateApiKey,
  changePassword,
} from "../controllers/userController";
import { protect } from "../middleware/auth";

const router = Router();
router.use(protect);

router.get("/me", getMe);
router.patch("/profile", updateProfile);
router.get("/api-key/status", getApiKeyStatus); // NEW: Check if key exists
router.patch("/api-key", updateApiKey);
router.patch("/password", changePassword);

export default router;
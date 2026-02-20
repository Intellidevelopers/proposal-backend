import { Router } from "express";
import {
  getMe,
  updateProfile,
  getApiKeyStatus,
  updateApiKey,
  changePassword,
  getPlanStatus,
} from "../controllers/userController";
import { protect } from "../middleware/auth";

const router = Router();
router.use(protect);

router.get("/me", getMe);
router.get("/plan-status", getPlanStatus); // ← quota + feature flags
router.patch("/profile", updateProfile);
router.get("/api-key/status", getApiKeyStatus);
router.patch("/api-key", updateApiKey);
router.patch("/password", changePassword);

export default router;
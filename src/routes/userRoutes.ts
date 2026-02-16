// userRoutes.ts
import { Router } from "express";
import { getMe, updateProfile, updateApiKey, changePassword } from "../controllers/userController";
import { protect } from "../middleware/auth";
const router = Router();
router.use(protect);
router.get("/me", getMe);
router.patch("/profile",  updateProfile);
router.patch("/api-key",  updateApiKey);
router.patch("/password", changePassword);
export default router;
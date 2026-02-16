import { Router } from "express";
import { signup, login } from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";
const router = Router();
router.post("/signup", authLimiter, signup);
router.post("/login",  authLimiter, login);
export default router;
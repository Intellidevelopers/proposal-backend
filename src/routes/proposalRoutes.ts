// proposalRoutes.ts
import { Router } from "express";
import { generate, getProposals, deleteProposal } from "../controllers/proposalController";
import { protect } from "../middleware/auth";
import { generateLimiter } from "../middleware/rateLimiter";
const router = Router();
router.use(protect);
router.post("/generate", generate);
router.get("/", getProposals);
router.delete("/:id", deleteProposal);
export default router;
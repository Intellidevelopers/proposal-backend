import { Router } from "express";
import { generate, getProposals, deleteProposal, exportPdf } from "../controllers/proposalController";
import { protect } from "../middleware/auth";

const router = Router();
router.use(protect);

router.post("/generate", generate);
router.get("/", getProposals);
router.delete("/:id", deleteProposal);
router.get("/:id/export-pdf", exportPdf); // Pro only

export default router;
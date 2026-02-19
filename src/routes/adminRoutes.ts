import { Router } from "express";
import { protect } from "../middleware/auth";
import { isAdmin } from "../middleware/auth";
import {
  getStats,
  getUsers,
  getProposals,
  getActivity,
  getUsage,
  updateUser,
  deleteUser,
  deleteProposal,
  getSettings,
  getGeoDistribution,
} from "../controllers/adminController";

const router = Router();

// All admin routes require a valid JWT + admin role
router.use(protect, isAdmin);

// ── Overview dashboard
router.get("/stats",     getStats);    // stat cards + plan breakdown + 6-month usage chart

// ── Users
router.get("/users",     getUsers);    // ?page=1&limit=8&search=&plan=All&sortKey=createdAt&sortDir=desc
router.patch("/users/:id", updateUser); // { plan?, role? }
router.delete("/users/:id", deleteUser);

// ── Proposals
router.get("/proposals",       getProposals);   // ?page=1&limit=8&search=&sortKey=createdAt&sortDir=desc
router.delete("/proposals/:id", deleteProposal);

// ── Activity feed
router.get("/activity", getActivity);  // ?limit=20

// ── Usage analytics
router.get("/usage", getUsage);        // ?days=30

// ── System settings
router.get("/settings", getSettings);

// ── Geographic distribution
router.get("/geo", getGeoDistribution);   // ← new

export default router;
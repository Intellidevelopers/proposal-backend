import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import Proposal from "../models/Proposal";
import User, { FREE_MONTHLY_CAP } from "../models/User";
import { generateProposal } from "../services/aiService";
import { ApiError } from "../utils/ApiError";

// ─── Helper: reset monthly counter if month rolled over ──────────────────────
function resetIfNewMonth(user: InstanceType<typeof User>) {
  const now = new Date();
  const reset = new Date(user.resetProposalsAt);
  if (
    now.getMonth() !== reset.getMonth() ||
    now.getFullYear() !== reset.getFullYear()
  ) {
    user.proposalsThisMonth = 0;
    user.resetProposalsAt = now;
  }
}

// ─── POST /proposals/generate ────────────────────────────────────────────────
export const generate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { jobDescription, skills, experience, tone, length, budget, timeline } = req.body;
    if (!jobDescription?.trim()) throw new ApiError("Job description required.", 400);

    const user = await User.findById(req.user!.id).select("+cohereApiKey");
    if (!user) throw new ApiError("User not found.", 404);

    // ── Plan enforcement ──────────────────────────────────────────────────────
    if (user.plan === "Free") {
      resetIfNewMonth(user);

      if (!user.canGenerate()) {
        throw new ApiError(
          `Free plan limit of ${FREE_MONTHLY_CAP} proposals/month reached. Upgrade to Pro for unlimited proposals.`,
          403
        );
      }
    }

    // ── AI generation ─────────────────────────────────────────────────────────
    const { text, score } = await generateProposal({
      jobDescription,
      skills:    skills || [],
      experience: experience || "mid",
      tone:      tone || "confident",
      length:    length || "medium",
      budget,
      timeline,
      userApiKey: user.cohereApiKey || undefined,
    });

    // ── Advanced scoring only for Pro ─────────────────────────────────────────
    // Free users get a rounded/simplified score; Pro gets the full decimal score
    const finalScore = user.isPro() ? score : Math.round(score / 5) * 5;

    const proposal = await Proposal.create({
      user:          req.user!.id,
      jobTitle:      jobDescription.slice(0, 60) + (jobDescription.length > 60 ? "..." : ""),
      jobDescription,
      generatedText: text,
      score:         finalScore,
      tone,
      length,
      skills:    skills || [],
      experience,
      budget,
      timeline,
    });

    // Increment counter for free users
    if (user.plan === "Free") {
      user.proposalsThisMonth += 1;
      await user.save({ validateBeforeSave: false });
    }

    res.status(201).json({
      success: true,
      proposal,
      // Tell the frontend what plan features apply
      meta: {
        plan:               user.plan,
        proposalsThisMonth: user.proposalsThisMonth,
        proposalsRemaining: user.isPro() ? null : FREE_MONTHLY_CAP - user.proposalsThisMonth,
        canExportPdf:       user.isPro(),
        advancedScoring:    user.isPro(),
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /proposals ───────────────────────────────────────────────────────────
export const getProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposals = await Proposal.find({ user: req.user!.id }).sort({ createdAt: -1 });
    res.json({ success: true, proposals });
  } catch (err) { next(err); }
};

// ─── DELETE /proposals/:id ────────────────────────────────────────────────────
export const deleteProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await Proposal.findOne({ _id: req.params.id, user: req.user!.id });
    if (!p) throw new ApiError("Not found.", 404);
    await p.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── GET /proposals/:id/export-pdf ───────────────────────────────────────────
// Pro-only endpoint. Free users get a 403 with an upgrade message.
export const exportPdf = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) throw new ApiError("User not found.", 404);

    if (!user.isPro()) {
      throw new ApiError("PDF export is a Pro feature. Upgrade to unlock.", 403);
    }

    const proposal = await Proposal.findOne({ _id: req.params.id, user: req.user!.id });
    if (!proposal) throw new ApiError("Proposal not found.", 404);

    // Return the text so the frontend can render the PDF (e.g. with jsPDF)
    // Or generate server-side PDF bytes here if you add a PDF lib later
    res.json({
      success: true,
      data: {
        jobTitle:      proposal.jobTitle,
        generatedText: proposal.generatedText,
        score:         proposal.score,
        tone:          proposal.tone,
        length:        proposal.length,
        createdAt:     proposal.createdAt,
      },
    });
  } catch (err) { next(err); }
};
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import Proposal from "../models/Proposal";
import User from "../models/User";
import { generateProposal } from "../services/aiService";   // updated import
import { ApiError } from "../utils/ApiError";

const FREE_CAP = 10;

export const generate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { jobDescription, skills, experience, tone, length, budget, timeline } = req.body;
    if (!jobDescription?.trim()) throw new ApiError("Job description required.", 400);

    const user = await User.findById(req.user!.id);
    if (!user) throw new ApiError("User not found.", 404);

    // Monthly quota for Free users
    if (user.plan === "Free") {
      const now = new Date(), reset = new Date(user.resetProposalsAt);
      if (now.getMonth() !== reset.getMonth() || now.getFullYear() !== reset.getFullYear()) {
        user.proposalsThisMonth = 0;
        user.resetProposalsAt   = now;
      }
      if (user.proposalsThisMonth >= FREE_CAP)
        throw new ApiError(`Free plan limit (${FREE_CAP}/month) reached. Upgrade to Pro.`, 403);
    }

    const { text, score } = await generateProposal({
      jobDescription,
      skills:      skills || [],
      experience:  experience || "mid",
      tone:        tone || "confident",
      length:      length || "medium",
      budget,
      timeline,
      userApiKey:  user.cohereApiKey || undefined,   // updated field name
    });

    const proposal = await Proposal.create({
      user:          req.user!.id,
      jobTitle:      jobDescription.slice(0, 60) + (jobDescription.length > 60 ? "..." : ""),
      jobDescription,
      generatedText: text,
      score,
      tone,
      length,
      skills:     skills || [],
      experience,
      budget,
      timeline,
    });

    user.proposalsThisMonth += 1;
    await user.save({ validateBeforeSave: false });
    res.status(201).json({ success: true, proposal });
  } catch (err) { next(err); }
};

export const getProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposals = await Proposal.find({ user: req.user!.id }).sort({ createdAt: -1 });
    res.json({ success: true, proposals });
  } catch (err) { next(err); }
};

export const deleteProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await Proposal.findOne({ _id: req.params.id, user: req.user!.id });
    if (!p) throw new ApiError("Not found.", 404);
    await p.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
};
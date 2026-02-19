import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import User from "../models/User";
import Proposal from "../models/Proposal";
import { ApiError } from "../utils/ApiError";

// ─── GET /admin/stats ────────────────────────────────────────────────────────
// Overview dashboard: stat cards + plan breakdown + usage chart data
export const getStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalProposals, planCounts] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Proposal.countDocuments(),
      User.aggregate([
        { $match: { role: "user" } },
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ])

    ]);

    // Build plan map: { Free: N, Pro: N }
    const planMap: Record<string, number> = { Free: 0, Pro: 0 };
    for (const p of planCounts) planMap[p._id] = p.count;

    // MRR: Pro = $49/mo (adjust if you add pricing to the model)
    const MRR_PRO = 49;
    const mrr = planMap["Pro"] * MRR_PRO;

    // Proposals per month for the last 6 months (usage chart)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const usageByMonth = await Proposal.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, user: { $ne: null } } },
      {
        $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
          },
          proposals: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const usageChart = usageByMonth.map((d) => ({
      month: monthNames[d._id.month - 1],
      proposals: d.proposals,
    }));

    // Avg proposals per user
    const avgProposals = totalUsers > 0 ? (totalProposals / totalUsers).toFixed(1) : "0";

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProposals,
        avgProposalsPerUser: Number(avgProposals),
        mrr,
        planBreakdown: planMap,
      },
      usageChart,
    });
  } catch (err) { next(err); }
};

// ─── GET /admin/users ────────────────────────────────────────────────────────
// Paginated, filtered, sorted user list
export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = "1",
      limit = "8",
      search = "",
      plan = "All",
      sortKey = "createdAt",
      sortDir = "desc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));

    const filter: Record<string, any> = {
      role: "user", // ✅ always exclude admin
    };

    if (plan !== "All") filter.plan = plan;

    if (search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const allowedSortKeys = ["name", "createdAt", "proposalsThisMonth", "plan"];
    const safeSort = allowedSortKeys.includes(sortKey) ? sortKey : "createdAt";
    const dir = sortDir === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [safeSort]: dir })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .select("-password -cohereApiKey")
        .lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);

    const proposalCounts = await Proposal.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    for (const pc of proposalCounts) {
      countMap[String(pc._id)] = pc.count;
    }

    const enriched = users.map((u) => ({
      ...u,
      totalProposals: countMap[String(u._id)] ?? 0,
    }));

    res.json({
      success: true,
      users: enriched,
      pagination: {
        page: pageNum,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
};


// ─── GET /admin/proposals ────────────────────────────────────────────────────
// Paginated, filtered, sorted proposals list
export const getProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = "1",
      limit = "8",
      search = "",
      sortKey = "createdAt",
      sortDir = "desc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));

    const filter: Record<string, any> = {};
    if (search.trim()) {
      filter.$or = [
        { jobTitle: { $regex: search.trim(), $options: "i" } },
        { jobDescription: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const allowedSortKeys = ["createdAt", "score", "tone", "length"];
    const safeSort = allowedSortKeys.includes(sortKey) ? sortKey : "createdAt";
    const dir = sortDir === "asc" ? 1 : -1;

    const proposals = await Proposal.find(filter)
      .sort({ [safeSort]: dir })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .populate({
        path: "user",
        match: { role: "user" }, // ✅ exclude admin proposals
        select: "name email plan",
      })
      .select("-generatedText -jobDescription")
      .lean();

    const filtered = proposals.filter((p) => p.user !== null);

    res.json({
      success: true,
      proposals: filtered,
      pagination: {
        page: pageNum,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
};


// ─── GET /admin/activity ─────────────────────────────────────────────────────
// Latest 20 proposal-generation events as an activity feed
export const getActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(50, parseInt((req.query.limit as string) || "20"));

    const recent = await Proposal.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "user",
        match: { role: "user" }, // ✅ exclude admin
        select: "name email",
      })
      .select("jobTitle score tone createdAt user")
      .lean();

    const filtered = recent.filter((p) => p.user !== null);

    const feed = filtered.map((p) => ({
      id: String(p._id),
      type: "proposal_generated",
      user: (p.user as any)?.name ?? "Unknown",
      email: (p.user as any)?.email ?? "",
      title: p.jobTitle,
      score: p.score,
      tone: p.tone,
      createdAt: p.createdAt,
    }));

    res.json({ success: true, feed });
  } catch (err) {
    next(err);
  }
};


// ─── GET /admin/usage ────────────────────────────────────────────────────────
// Token / proposal usage breakdown — per-plan and daily for the last N days
export const getUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) || "30")));
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Daily proposals
    const dailyRaw = await Proposal.aggregate([
      { $match: { createdAt: { $gte: since }, user: { $ne: null } } },
      {
        $group: {
          _id: {
            year:  { $year:  "$createdAt" },
            month: { $month: "$createdAt" },
            day:   { $dayOfMonth: "$createdAt" },
          },
          proposals: { $sum: 1 },
          avgScore:  { $avg: "$score" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    const daily = dailyRaw.map((d) => ({
      date: `${d._id.month}/${d._id.day}`,
      proposals: d.proposals,
      avgScore: Math.round(d.avgScore),
    }));

    // Per-plan proposal volume
    const byPlan = await Proposal.aggregate([
      { $match: { createdAt: { $gte: since }, user: { $ne: null } } },
      {
        $lookup: {
          from:         "users",
          localField:   "user",
          foreignField: "_id",
          as:           "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id:       "$userDoc.plan",
          proposals: { $sum: 1 },
          users:     { $addToSet: "$user" },
        },
      },
      {
        $project: {
          plan:      "$_id",
          proposals: 1,
          uniqueUsers: { $size: "$users" },
        },
      },
    ]);

    // Top users by proposal count in window
    const topUsers = await Proposal.aggregate([
      { $match: { createdAt: { $gte: since }, user: { $ne: null } } },
      { $group: { _id: "$user", proposals: { $sum: 1 }, avgScore: { $avg: "$score" } } },
      { $sort: { proposals: -1 } },
      { $limit: 10 },
      {
        $match: {
          "userDoc.role": { $ne: "admin" },
        },
      },
      {
        $lookup: {
          from:         "users",
          localField:   "_id",
          foreignField: "_id",
          as:           "userDoc",
        },
      },
      { $unwind: "$userDoc" },
      {
        $project: {
          name:      "$userDoc.name",
          email:     "$userDoc.email",
          plan:      "$userDoc.plan",
          proposals: 1,
          avgScore:  { $round: ["$avgScore", 1] },
        },
      },
    ]);

    // Tone distribution
    const toneBreakdown = await Proposal.aggregate([
      { $match: { createdAt: { $gte: since }, user: { $ne: null } } },
      { $group: { _id: "$tone", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      window: { days, since },
      daily,
      byPlan,
      topUsers,
      toneBreakdown: toneBreakdown.map((t) => ({ tone: t._id, count: t.count })),
    });
  } catch (err) { next(err); }
};

// ─── PATCH /admin/users/:id ──────────────────────────────────────────────────
// Admin: update user plan or role
export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan, role } = req.body as { plan?: string; role?: string };

    const allowed: Record<string, string[]> = {
      plan: ["Free", "Pro"],
      role: ["user", "admin"],
    };

    const update: Record<string, string> = {};
    if (plan && allowed.plan.includes(plan)) update.plan = plan;
    if (role && allowed.role.includes(role)) update.role = role;

    if (Object.keys(update).length === 0)
      throw new ApiError("No valid fields to update.", 400);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) throw new ApiError("User not found.", 404);

    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// ─── DELETE /admin/users/:id ─────────────────────────────────────────────────
// Admin: remove user and all their proposals
export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError("User not found.", 404);

    await Proposal.deleteMany({ user: req.params.id });

    res.json({ success: true, message: "User and their proposals deleted." });
  } catch (err) { next(err); }
};

// ─── DELETE /admin/proposals/:id ─────────────────────────────────────────────
export const deleteProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await Proposal.findByIdAndDelete(req.params.id);
    if (!p) throw new ApiError("Proposal not found.", 404);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── GET /admin/settings ─────────────────────────────────────────────────────
// Returns non-secret system config the admin UI can display/edit
export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      settings: {
        freeMonthlyProposalCap: 10,
        defaultModel: "c4ai-aya-expanse-32b",
        defaultTone: "confident",
        defaultLength: "medium",
        allowUserApiKeys: true,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /admin/geo ───────────────────────────────────────────────────────────
// Returns geographic distribution of users by country.
// Reads the `country` field on User (populated at register/login via geoip.ts).
// Buckets the top 7 countries; everything else collapses into "Other".
export const getGeoDistribution = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const raw = await User.aggregate([
      { $match: { country: { $exists: true, $nin: ["", null] } } },
      { $group: { _id: "$country", users: { $sum: 1 } } },
      { $sort: { users: -1 } },
    ]);

    const total = raw.reduce((sum, r) => sum + (r.users as number), 0);

    const TOP_N = 7;
    const top   = raw.slice(0, TOP_N);
    const rest  = raw.slice(TOP_N).reduce((sum, r) => sum + (r.users as number), 0);

    const distribution = top.map((r) => ({
      country: r._id as string,
      users:   r.users as number,
      pct:     total > 0 ? parseFloat(((r.users / total) * 100).toFixed(1)) : 0,
    }));

    if (rest > 0) {
      distribution.push({
        country: "Other",
        users:   rest,
        pct:     total > 0 ? parseFloat(((rest / total) * 100).toFixed(1)) : 0,
      });
    }

    res.json({ success: true, total, distribution });
  } catch (err) { next(err); }
};
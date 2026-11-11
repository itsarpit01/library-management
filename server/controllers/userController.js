import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Transaction from "../models/Transaction.js";
import { MEMBERSHIP_TIERS } from "../config/membershipConfig.js";
import { withOverdueInfo } from "../utils/fine.js";

const getEffectiveMembership = (user) => {
  const mem = user.membership || { tier: "free", expiresAt: null };
  if (mem.tier !== "free" && mem.expiresAt && new Date(mem.expiresAt) < new Date()) {
    return { tier: "free", expiresAt: null, isExpired: true };
  }
  return { tier: mem.tier || "free", expiresAt: mem.expiresAt || null };
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  membership: getEffectiveMembership(user),
});

const removeOldAvatar = (avatarPath) => {
  if (!avatarPath || !avatarPath.startsWith("/uploads/profiles/")) return;
  fs.unlink(path.join(process.cwd(), avatarPath), () => {});
};

// GET /api/users/members (librarian: all members sorted by most recent interaction)
export const getMembers = async (req, res) => {
  try {
    const users = await User.find({ role: "purchaser" })
      .select("name email avatar createdAt membership")
      .lean();

    const userIds = users.map((u) => u._id);

    // Aggregate active issues, UNPAID fines only, and latest interaction dates
    const [issueStats, requestStats, txStats] = await Promise.all([
      Issue.aggregate([
        { $match: { member: { $in: userIds } } },
        {
          $group: {
            _id: "$member",
            activeIssuesCount: {
              $sum: { $cond: [{ $eq: ["$status", "issued"] }, 1, 0] },
            },
            // Sirf unpaid fines ko count karega, paid fines exclude honge
            totalFines: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$finePaid", false] }, { $gt: ["$fine", 0] }] },
                  "$fine",
                  0,
                ],
              },
            },
            overdueCount: {
              $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
            },
            lastIssueDate: { $max: "$createdAt" },
          },
        },
      ]),
      PurchaseRequest.aggregate([
        {
          $match: {
            requestedBy: { $in: userIds },
          },
        },
        {
          $group: {
            _id: "$requestedBy",
            pendingRequestsCount: {
              $sum: {
                $cond: [{ $in: ["$status", ["pending", "counter_offered"]] }, 1, 0],
              },
            },
            lastRequestDate: { $max: "$createdAt" },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { user: { $in: userIds }, status: "success" } },
        {
          $group: {
            _id: "$user",
            lastTransactionDate: { $max: "$createdAt" },
          },
        },
      ]),
    ]);

    const issueMap = new Map(issueStats.map((item) => [String(item._id), item]));
    const reqMap = new Map(requestStats.map((item) => [String(item._id), item]));
    const txMap = new Map(txStats.map((item) => [String(item._id), item]));

    const result = users.map((u) => {
      const stats = issueMap.get(String(u._id)) || {};
      const reqStats = reqMap.get(String(u._id)) || {};
      const txStat = txMap.get(String(u._id)) || {};

      const candidateDates = [
        u.createdAt,
        u.membership?.startedAt,
        stats.lastIssueDate,
        reqStats.lastRequestDate,
        txStat.lastTransactionDate,
      ].filter(Boolean);

      const lastActivityAt = candidateDates.length
        ? new Date(Math.max(...candidateDates.map((d) => new Date(d).getTime())))
        : u.createdAt;

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: "purchaser",
        membership: getEffectiveMembership(u),
        createdAt: u.createdAt,
        lastActivityAt,
        activeBooksCount: stats.activeIssuesCount || 0,
        pendingRequestsCount: reqStats.pendingRequestsCount || 0,
        totalFines: stats.totalFines || 0,
        overdueCount: stats.overdueCount || 0,
      };
    });

    result.sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user records" });
  }
};

// GET /api/users/members/:id/activity (librarian: inspect single member history)
export const getMemberActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await User.findById(id).select("-password").lean();
    if (!member) return res.status(404).json({ message: "Member not found" });

    const [rawIssues, requests] = await Promise.all([
      Issue.find({ member: id }).populate("book").sort({ createdAt: -1 }).lean(),
      PurchaseRequest.find({ requestedBy: id }).sort({ createdAt: -1 }).lean(),
    ]);

    // Issues ko withOverdueInfo ke sath populate karein taaki finePaid status pass ho
    const issues = rawIssues.map(withOverdueInfo);

    res.json({
      member: {
        ...member,
        membership: getEffectiveMembership(member),
      },
      issues,
      requests,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch member activity" });
  }
};

// GET /api/users/me (any logged-in user)
export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ ...publicUser(user), createdAt: user.createdAt });
};

// PATCH /api/users/me (any logged-in user): name + avatar
export const updateMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (req.body.name) user.name = req.body.name;

  if (req.file) {
    removeOldAvatar(user.avatar);
    user.avatar = `/uploads/profiles/${req.file.filename}`;
  }

  await user.save();
  res.json({ user: publicUser(user) });
};

// POST /api/users/upgrade-membership (purchaser fallback)
export const upgradeMembership = async (req, res) => {
  if (process.env.ALLOW_FREE_UPGRADE !== "true") {
    return res.status(403).json({
      message: "Online upgrade is not available yet. Payment integration is coming soon.",
    });
  }

  const { tier } = req.body;
  if (!["premium", "ultimate"].includes(tier)) {
    return res.status(400).json({ message: "Invalid membership tier" });
  }

  const tierConfig = MEMBERSHIP_TIERS[tier];
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + tierConfig.durationMonths);

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { membership: { tier, expiresAt } },
    { new: true }
  );

  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({
    message: `Successfully upgraded to ${tierConfig.name}!`,
    user: publicUser(user),
  });
};

// PATCH /api/users/me/password (any logged-in user)
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({
      message: "Validation failed",
      errors: [{ field: "currentPassword", message: "Current password is incorrect" }],
    });
  }

  if (await bcrypt.compare(newPassword, user.password)) {
    return res.status(400).json({
      message: "Validation failed",
      errors: [{ field: "newPassword", message: "New password must be different" }],
    });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: "Password changed successfully" });
};
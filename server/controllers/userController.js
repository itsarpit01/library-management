import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import { MEMBERSHIP_TIERS } from "../config/membershipConfig.js";

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

// GET /api/users/members (librarian: all members with live issue/request/fine counts)
export const getMembers = async (req, res) => {
  try {
    const users = await User.find({ role: "purchaser" })
      .select("name email avatar createdAt membership")
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((u) => u._id);

    // Aggregate active issues count and total fines per user
    const [issueStats, requestStats] = await Promise.all([
      Issue.aggregate([
        { $match: { member: { $in: userIds } } },
        {
          $group: {
            _id: "$member",
            activeIssuesCount: {
              $sum: { $cond: [{ $eq: ["$status", "issued"] }, 1, 0] },
            },
            totalFines: { $sum: "$fine" },
            overdueCount: {
              $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
            },
          },
        },
      ]),
      PurchaseRequest.aggregate([
        {
          $match: {
            requestedBy: { $in: userIds },
            status: { $in: ["pending", "counter_offered"] },
          },
        },
        {
          $group: {
            _id: "$requestedBy",
            pendingRequestsCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const issueMap = new Map(issueStats.map((item) => [String(item._id), item]));
    const reqMap = new Map(requestStats.map((item) => [String(item._id), item.pendingRequestsCount]));

    const result = users.map((u) => {
      const stats = issueMap.get(String(u._id)) || {};
      const pendingReqs = reqMap.get(String(u._id)) || 0;

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: "purchaser",
        membership: getEffectiveMembership(u),
        createdAt: u.createdAt,
        activeBooksCount: stats.activeIssuesCount || 0,
        pendingRequestsCount: pendingReqs,
        totalFines: stats.totalFines || 0,
        overdueCount: stats.overdueCount || 0,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user records" });
  }
};

// GET /api/users/members/:id/activity (librarian: inspect single member history & current issues)
export const getMemberActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await User.findById(id).select("-password").lean();
    if (!member) return res.status(404).json({ message: "Member not found" });

    const [issues, requests] = await Promise.all([
      Issue.find({ member: id }).populate("book").sort({ createdAt: -1 }).lean(),
      PurchaseRequest.find({ requestedBy: id }).sort({ createdAt: -1 }).lean(),
    ]);

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
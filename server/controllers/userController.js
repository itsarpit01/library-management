import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
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

// Purani avatar file disk se hatao (sirf uploads/profiles ke andar ki)
const removeOldAvatar = (avatarPath) => {
  if (!avatarPath || !avatarPath.startsWith("/uploads/profiles/")) return;
  fs.unlink(path.join(process.cwd(), avatarPath), () => {});
};

// GET /api/users/members (librarian)
export const getMembers = async (req, res) => {
  const members = await User.find({ role: "purchaser" })
    .select("name email createdAt membership")
    .sort({ name: 1 });
  res.json(members);
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

// POST /api/users/upgrade-membership (purchaser)
// Bina payment ke ye koi bhi plan de deta hai, isliye sirf ALLOW_FREE_UPGRADE=true par chalta hai.
// Payment gateway aane par is flag ki jagah payment verification lagao.
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
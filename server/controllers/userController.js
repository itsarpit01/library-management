import bcrypt from "bcryptjs";
import User from "../models/User.js";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// GET /api/users/members (librarian)
export const getMembers = async (req, res) => {
  const members = await User.find({ role: "purchaser" })
    .select("name email createdAt")
    .sort({ name: 1 });
  res.json(members);
};

// GET /api/users/me (any logged-in user)
export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ ...publicUser(user), createdAt: user.createdAt });
};

// PATCH /api/users/me (any logged-in user): sirf name
export const updateMe = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name: req.body.name },
    { new: true }
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user: publicUser(user) });
};

// PATCH /api/users/me/password (any logged-in user)
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    // 401 nahi bhejte, warna axios interceptor user ko logout kar dega
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
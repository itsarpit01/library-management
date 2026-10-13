import User from "../models/User.js";

// GET /api/users/members (librarian)
export const getMembers = async (req, res) => {
  const members = await User.find({ role: "purchaser" })
    .select("name email createdAt")
    .sort({ name: 1 });
  res.json(members);
};
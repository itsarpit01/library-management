import User from "../models/User.js";

// GET /api/users/members  (librarian)
export const getMembers = async (req, res) => {
  try {
    const members = await User.find({ role: "purchaser" })
      .select("name email createdAt")
      .sort({ name: 1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
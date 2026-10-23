import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const resetAllToFree = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/library_management");
    const result = await User.updateMany(
      {},
      { membership: { tier: "free", expiresAt: null } }
    );
    console.log(`✅ Success: Reset ${result.modifiedCount} user(s) back to Free tier!`);
    process.exit(0);
  } catch (err) {
    console.error("Error resetting memberships:", err);
    process.exit(1);
  }
};

resetAllToFree();
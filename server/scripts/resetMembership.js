import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

// Haath se chalane ke liye: sab users ko Free kar deta hai.
// Kisi aur file se import mat karo (import par ye turant chal jati hai).
try {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await User.updateMany(
    {},
    { $set: { membership: { tier: "free", expiresAt: null } } }
  );
  console.log(`Reset ${result.modifiedCount} user(s) to Free tier`);
} catch (err) {
  console.error("Error resetting memberships:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
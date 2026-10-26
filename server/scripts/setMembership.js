import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import { MEMBERSHIP_TIERS } from "../config/membershipConfig.js";

const [email, tier, monthsArg] = process.argv.slice(2);

if (!email || !MEMBERSHIP_TIERS[tier]) {
  console.log("Usage: pnpm set-membership email@example.com free|premium|ultimate [months]");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  let expiresAt = null;
  if (tier !== "free") {
    const months = Number(monthsArg) || MEMBERSHIP_TIERS[tier].durationMonths;
    expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);
  }

  const user = await User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { membership: { tier, expiresAt } } },
    { new: true }
  );
  console.log(user ? `${user.email} is now ${tier}${expiresAt ? ` until ${expiresAt.toDateString()}` : ""}` : "User not found");
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
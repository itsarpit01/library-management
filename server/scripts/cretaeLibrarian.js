import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config();

const [name, email, password] = process.argv.slice(2);

const usage = 'Usage: pnpm create-librarian "Name" email@example.com \'Library@123\'';

if (!name || !email || !password) {
  console.log(usage);
  process.exit(1);
}

const normalized = email.trim().toLowerCase();
const cleanName = name.trim();

if (cleanName.length < 2) {
  console.log("Name must be at least 2 characters");
  process.exit(1);
}

if (!/^\S+@\S+\.\S+$/.test(normalized)) {
  console.log("Invalid email address");
  process.exit(1);
}

const strong =
  password.length >= 8 &&
  password.length <= 72 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

if (!strong) {
  console.log("Password must be 8-72 characters with capital, small, number and special character");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: normalized });

  if (existing) {
    if (existing.role === "librarian") {
      console.log(`${normalized} is already a librarian`);
    } else {
      // Password nahi badalta, sirf role promote hota hai
      existing.role = "librarian";
      await existing.save();
      console.log(`Existing user ${normalized} promoted to librarian (password unchanged)`);
    }
  } else {
    await User.create({
      name: cleanName,
      email: normalized,
      password: await bcrypt.hash(password, 10),
      role: "librarian",
    });
    console.log(`Librarian created: ${normalized}`);
  }
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
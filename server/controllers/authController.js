import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import { sendOtpEmail } from "../utils/mailer.js";

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    // Zod (validate middleware) pehle hi name, email, password check kar chuka hai.
    // role yahan se nahi liya jata: public register se hamesha purchaser.
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "purchaser",
    });

    res.status(201).json({ token: generateToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    // Same message dono cases mein, taaki pata na chale ki email exist karta hai ya nahi
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    res.json({ token: generateToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ---------------- Forgot password (OTP) ---------------- */

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

// OTP ko secret ke saath HMAC karte hain (DB leak se OTP nahi milega)
const hashOtp = (otp) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(otp).digest("hex");

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const GENERIC = { message: "If this email is registered, an OTP has been sent" };

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    // User nahi hai to bhi same response (email exist karta hai ye chhupane ke liye)
    if (!user) return res.json(GENERIC);

    const existing = await PasswordReset.findOne({ email });
    if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      return res.json(GENERIC);
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

    await PasswordReset.findOneAndUpdate(
      { email },
      {
        otpHash: hashOtp(otp),
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
      { upsert: true }
    );

    try {
      await sendOtpEmail(email, user.name, otp);
    } catch (err) {
      console.error("OTP email failed:", err.message);
      await PasswordReset.deleteOne({ email });
      return res.status(500).json({ message: "Could not send email, please try again later" });
    }

    res.json(GENERIC);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const record = await PasswordReset.findOne({ email });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: [{ field: "otp", message: "OTP expired or invalid. Request a new one." }],
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await PasswordReset.deleteOne({ email });
      return res.status(400).json({
        message: "Validation failed",
        errors: [{ field: "otp", message: "Too many wrong attempts. Request a new OTP." }],
      });
    }

    if (!safeEqual(record.otpHash, hashOtp(otp))) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({
        message: "Validation failed",
        errors: [{ field: "otp", message: "Incorrect OTP" }],
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await PasswordReset.deleteOne({ email });
      return res.status(400).json({ message: "Account not found" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await PasswordReset.deleteOne({ email }); // OTP ek hi baar use hota hai

    res.json({ message: "Password reset successful. Please login." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
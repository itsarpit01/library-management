import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  // TTL: expiresAt guzarte hi MongoDB document khud delete kar deta hai
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export default mongoose.model("PasswordReset", passwordResetSchema);
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["librarian", "purchaser"],
      default: "purchaser",
    },
    avatar: { type: String, default: "" },
    membership: {
      tier: {
        type: String,
        enum: ["free", "premium", "ultimate"],
        default: "free",
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
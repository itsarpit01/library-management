import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: 6,
    },
    googleId: { type: String, default: null },
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
      startedAt: {
        type: Date,
        default: null,
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
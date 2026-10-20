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
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
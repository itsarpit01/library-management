import mongoose from "mongoose";

const borrowRequestSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["borrow", "reissue"], required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "Issue" }, // sirf reissue ke liye
    dueDate: { type: Date, required: true }, // member ne jis date tak maangi
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
    resultIssue: { type: mongoose.Schema.Types.ObjectId, ref: "Issue" },
  },
  { timestamps: true }
);

// DB level guard: ek member ki ek book par ek hi pending borrow request
borrowRequestSchema.index(
  { member: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: "pending", type: "borrow" } }
);
// Ek issue par ek hi pending reissue request
borrowRequestSchema.index(
  { issue: 1 },
  { unique: true, partialFilterExpression: { status: "pending", type: "reissue" } }
);

export default mongoose.model("BorrowRequest", borrowRequestSchema);
import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, required: true, unique: true, trim: true },
    category: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    totalCopies: { type: Number, required: true, min: 1, default: 1 },
    availableCopies: { type: Number, min: 0 },
    coverImage: { type: String, default: "" },
  },
  { timestamps: true }
);


bookSchema.index({ category: 1 });
bookSchema.index({ createdAt: -1 });

export default mongoose.model("Book", bookSchema);
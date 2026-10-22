import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    status: { type: String, enum: ["issued", "returned"], default: "issued" },
    fine: { type: Number, default: 0, min: 0 },
    reissueCount: { type: Number, default: 0, min: 0 },
    reissueRequested: { type: Boolean, default: false }, // ← NEW
    reissueRequestedDate: { type: Date },                 // ← NEW
  },
  { timestamps: true }
);

// Ek member ek time par ek hi book ki ek active copy le sakta hai (DB level guard)
issueSchema.index(
  { book: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: "issued" } }
);

export default mongoose.model("Issue", issueSchema);
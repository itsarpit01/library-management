import mongoose from "mongoose";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Book from "../models/Book.js";

const checkId = (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid request id" });
    return false;
  }
  return true;
};

const quantityCapError = (res, totalCopies) =>
  res.status(400).json({
    message: "Validation failed",
    errors: [
      {
        field: "quantity",
        message: `Library has only ${totalCopies} copies, you cannot request more`,
      },
    ],
  });

// POST /api/purchase-requests (purchaser)
export const createRequest = async (req, res) => {
  const { bookId, quantity, neededUntil, reason } = req.body;

  const book = await Book.findById(bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  // Cap: library ki total copies se zyada request nahi
  if (quantity > book.totalCopies) {
    return quantityCapError(res, book.totalCopies);
  }

  const request = await PurchaseRequest.create({
    requestedBy: req.user.id,
    book: book._id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    quantity,
    neededUntil,
    reason,
  });
  res.status(201).json(request);
};

// GET /api/purchase-requests/my (purchaser)
export const getMyRequests = async (req, res) => {
  const filter = { requestedBy: req.user.id };
  if (req.query.status) filter.status = req.query.status;

  const requests = await PurchaseRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("reviewedBy", "name");
  res.json(requests);
};

// PATCH /api/purchase-requests/:id (purchaser, sirf apna pending ya counter_offered)
export const updateRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;
  const { bookId, quantity, neededUntil, reason } = req.body;

  const existing = await PurchaseRequest.findOne({
    _id: req.params.id,
    requestedBy: req.user.id,
  });
  if (!existing) return res.status(404).json({ message: "Request not found" });
  if (existing.status !== "pending" && existing.status !== "counter_offered") {
    return res.status(409).json({ message: "Only pending or counter offered requests can be edited" });
  }

  const book = await Book.findById(bookId);
  if (!book) return res.status(404).json({ message: "Book not found" });

  if (quantity > book.totalCopies) {
    return quantityCapError(res, book.totalCopies);
  }

  // Atomic: review ke beech mein edit na ho jaye
  const updated = await PurchaseRequest.findOneAndUpdate(
    { _id: existing._id, requestedBy: req.user.id, status: { $in: ["pending", "counter_offered"] } },
    {
      book: book._id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity,
      neededUntil,
      reason,
      status: "pending",
      proposedDate: null,
    },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ message: "Request was already reviewed" });
  }
  res.json(updated);
};

// PATCH /api/purchase-requests/:id/accept-counter (purchaser)
export const acceptCounterOffer = async (req, res) => {
  if (!checkId(req.params.id, res)) return;

  const existing = await PurchaseRequest.findOne({
    _id: req.params.id,
    requestedBy: req.user.id,
    status: "counter_offered",
  });

  if (!existing) {
    return res.status(404).json({ message: "Counter offer not found or not in counter_offered status" });
  }

  if (!existing.proposedDate) {
    return res.status(400).json({ message: "No proposed date found on this counter offer" });
  }

  // User accepts librarian's proposed date: neededUntil matches proposedDate
  existing.neededUntil = existing.proposedDate;
  existing.status = "pending";
  existing.reviewNote = existing.reviewNote ? `${existing.reviewNote} (Accepted proposed date by user)` : "Accepted proposed date by user";
  await existing.save();

  res.json(existing);
};

// DELETE /api/purchase-requests/:id (purchaser, pending ya counter_offered)
export const cancelRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;

  const deleted = await PurchaseRequest.findOneAndDelete({
    _id: req.params.id,
    requestedBy: req.user.id,
    status: { $in: ["pending", "counter_offered"] },
  });

  if (!deleted) {
    return res.status(404).json({ message: "Pending request not found" });
  }
  res.json({ message: "Request cancelled" });
};

// GET /api/purchase-requests?status=pending (librarian)
export const getAllRequests = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const requests = await PurchaseRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("requestedBy", "name email")
    .populate("reviewedBy", "name");
  res.json(requests);
};

// PATCH /api/purchase-requests/:id/review (librarian)
export const reviewRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;
  const { status, proposedDate, reviewNote } = req.body;

  const updateFields = {
    status,
    reviewNote,
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  };

  if (status === "counter_offered") {
    if (!proposedDate) {
      return res.status(400).json({ message: "Proposed date is required for counter offer" });
    }
    updateFields.proposedDate = proposedDate;
  }

  // Sirf pending ya counter_offered hi review hoga
  const updated = await PurchaseRequest.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ["pending", "counter_offered"] } },
    updateFields,
    { new: true }
  );

  if (!updated) {
    const exists = await PurchaseRequest.exists({ _id: req.params.id });
    return exists
      ? res.status(409).json({ message: "Request already reviewed" })
      : res.status(404).json({ message: "Request not found" });
  }
  res.json(updated);
};
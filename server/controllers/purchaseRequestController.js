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

// POST /api/purchase-requests (purchaser)
export const createRequest = async (req, res) => {
  const { bookId, quantity, reason } = req.body;

  const book = await Book.findById(bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  // Cap: library ki total copies se zyada request nahi
  if (quantity > book.totalCopies) {
    return res.status(400).json({
      message: "Validation failed",
      errors: [
        {
          field: "quantity",
          message: `Library has only ${book.totalCopies} copies, you cannot request more`,
        },
      ],
    });
  }

  const request = await PurchaseRequest.create({
    requestedBy: req.user.id,
    book: book._id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    quantity,
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

// DELETE /api/purchase-requests/:id (purchaser, sirf apna pending)
export const cancelRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;

  const deleted = await PurchaseRequest.findOneAndDelete({
    _id: req.params.id,
    requestedBy: req.user.id,
    status: "pending",
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
  const { status, reviewNote } = req.body;

  // Atomic: sirf pending hi update hoga, double review nahi hoga
  const updated = await PurchaseRequest.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    { status, reviewNote, reviewedBy: req.user.id, reviewedAt: new Date() },
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
// PATCH /api/purchase-requests/:id (purchaser, sirf apna pending)
export const updateRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;
  const { quantity, reason } = req.body;

  const existing = await PurchaseRequest.findOne({
    _id: req.params.id,
    requestedBy: req.user.id,
  });
  if (!existing) return res.status(404).json({ message: "Request not found" });
  if (existing.status !== "pending") {
    return res.status(409).json({ message: "Only pending requests can be edited" });
  }

  // Cap check: purani requests mein book ref na ho to ISBN se dhoondo
  const book = existing.book
    ? await Book.findById(existing.book)
    : await Book.findOne({ isbn: existing.isbn });

  if (book && quantity > book.totalCopies) {
    return res.status(400).json({
      message: "Validation failed",
      errors: [
        {
          field: "quantity",
          message: `Library has only ${book.totalCopies} copies, you cannot request more`,
        },
      ],
    });
  }

  // Atomic: review ke beech mein edit na ho jaye
  const updated = await PurchaseRequest.findOneAndUpdate(
    { _id: existing._id, requestedBy: req.user.id, status: "pending" },
    { quantity, reason },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ message: "Request was already reviewed" });
  }
  res.json(updated);
};
import mongoose from "mongoose";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import { getUserTierConfig } from "../config/membershipConfig.js";
import { endOfToday } from "../utils/dates.js";
import { assertDueWithinTier, httpError } from "../services/issueService.js";

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

  const [book, user] = await Promise.all([
    Book.findById(bookId),
    User.findById(req.user.id),
  ]);

  if (!book) return res.status(404).json({ message: "Book not found" });
  if (!user) return res.status(401).json({ message: "User not found" });

  const tierConfig = getUserTierConfig(user);

  // GATE 1: active issued books limit (Issue mein field "member" hai)
  if (tierConfig.maxBooks !== Infinity) {
    const activeIssuesCount = await Issue.countDocuments({
      member: req.user.id,
      status: "issued",
    });
    if (activeIssuesCount >= tierConfig.maxBooks) {
      return res.status(400).json({
        message: `Limit reached: Your ${tierConfig.name} plan allows a maximum of ${tierConfig.maxBooks} active issued books. Please return a book or upgrade your membership.`,
      });
    }
  }

  // GATE 2: plan ke hisaab se max din
  assertDueWithinTier(neededUntil, tierConfig);

  if (quantity > book.totalCopies) return quantityCapError(res, book.totalCopies);

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

  const [existing, user] = await Promise.all([
    PurchaseRequest.findOne({ _id: req.params.id, requestedBy: req.user.id }),
    User.findById(req.user.id),
  ]);

  if (!existing) return res.status(404).json({ message: "Request not found" });
  if (existing.status !== "pending" && existing.status !== "counter_offered") {
    return res.status(409).json({ message: "Only pending or counter offered requests can be edited" });
  }

  const book = await Book.findById(bookId);
  if (!book) return res.status(404).json({ message: "Book not found" });

  assertDueWithinTier(neededUntil, getUserTierConfig(user));

  if (quantity > book.totalCopies) return quantityCapError(res, book.totalCopies);

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
  if (!updated) return res.status(409).json({ message: "Request was already reviewed" });
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

  existing.neededUntil = existing.proposedDate;
  existing.proposedDate = null;
  existing.status = "pending"; // ab dono dates same, librarian approve kar sakta hai
  existing.reviewNote = existing.reviewNote
    ? `${existing.reviewNote} (Accepted proposed date by user)`
    : "Accepted proposed date by user";
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
  if (!deleted) return res.status(404).json({ message: "Pending request not found" });
  res.json({ message: "Request cancelled" });
};

// GET /api/purchase-requests?status=pending (librarian)
export const getAllRequests = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const requests = await PurchaseRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("requestedBy", "name email membership")
    .populate("reviewedBy", "name");
  res.json(requests);
};

// PATCH /api/purchase-requests/:id/review (librarian)
export const reviewRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;
  const { status, reviewNote } = req.body;

  const existing = await PurchaseRequest.findById(req.params.id).populate(
    "requestedBy",
    "membership"
  );
  if (!existing) return res.status(404).json({ message: "Request not found" });
  if (!["pending", "counter_offered"].includes(existing.status)) {
    return res.status(409).json({ message: "Request already reviewed" });
  }

  // Counter ke dauran approve nahi: pehle purchaser accept kare ya librarian naya counter/reject de
  if (status === "approved" && existing.status === "counter_offered") {
    throw httpError(409, "Waiting for the member to respond to your counter offer");
  }

  const update = {
    status,
    reviewNote,
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  };

  if (status === "counter_offered") {
    const proposed = new Date(req.body.proposedDate);
    proposed.setHours(23, 59, 59, 0); // din ka aakhri second

    if (proposed <= endOfToday()) {
      throw httpError(400, "Proposed date must be from tomorrow onwards");
    }
    if (existing.neededUntil && proposed >= existing.neededUntil) {
      throw httpError(
        400,
        "Proposed date is not earlier than the requested date. Approve the request instead."
      );
    }
    assertDueWithinTier(proposed, getUserTierConfig(existing.requestedBy));
    update.proposedDate = proposed;
  } else {
    update.proposedDate = null;
  }

  const updated = await PurchaseRequest.findOneAndUpdate(
    { _id: existing._id, status: existing.status }, // beech mein badla ho to fail
    update,
    { new: true }
  );
  if (!updated) return res.status(409).json({ message: "Request already reviewed" });
  res.json(updated);
};
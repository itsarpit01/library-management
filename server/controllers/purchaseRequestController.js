import PurchaseRequest from "../models/PurchaseRequest.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import Notification from "../models/Notification.js";
import { assertDueWithinTier } from "../services/issueService.js";
import { getUserTierConfig } from "../config/membershipConfig.js";
import { endOfToday } from "../utils/dates.js";
import { httpError } from "../services/issueService.js";
import mongoose from "mongoose";
import { sendNotification, notifyLibrarians } from "./notificationController.js";

const checkId = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid request ID format" });
    return false;
  }
  return true;
};

const quantityCapError = (res, totalCopies) =>
  res.status(400).json({
    message: `Quantity exceeds total copies owned by the library (${totalCopies}).`,
  });

// 100% Secure Server-Side Reason Validation
const validateReason = (reason, res) => {
  const trimmed = reason ? reason.trim() : "";
  if (!trimmed || trimmed.length < 10) {
    res.status(400).json({ message: "Please explain clearly why you need this book (at least 10 characters)" });
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const meaningfulWords = words.filter((w) => w.length >= 2 && /[a-zA-Z]/.test(w));
  if (meaningfulWords.length < 2) {
    res.status(400).json({ message: "Please provide a meaningful reason with at least 2 words" });
    return false;
  }

  const specialChars = trimmed.replace(/[a-zA-Z0-9\s]/g, "");
  if (specialChars.length / trimmed.length > 0.2) {
    res.status(400).json({ message: "Reason contains too many special characters or symbols" });
    return false;
  }

  if (/(.)\1{3,}/i.test(trimmed)) {
    res.status(400).json({ message: "Reason contains invalid repetitive characters" });
    return false;
  }

  return true;
};

// POST /api/purchase-requests (purchaser)
export const createRequest = async (req, res) => {
  const { bookId, quantity, neededUntil, reason } = req.body;

  const [book, user] = await Promise.all([
    Book.findById(bookId),
    User.findById(req.user.id),
  ]);

  if (!book) return res.status(404).json({ message: "Book not found" });

  const tierConfig = getUserTierConfig(user);

  // GATE 1: Quota check
  if (tierConfig.maxBooks !== Infinity) {
    const [activeIssuesCount, pendingRequestsCount] = await Promise.all([
      Issue.countDocuments({ member: req.user.id, status: "issued" }),
      PurchaseRequest.countDocuments({
        requestedBy: req.user.id,
        status: { $in: ["pending", "counter_offered"] },
      }),
    ]);

    const totalActiveUsed = activeIssuesCount + pendingRequestsCount;
    if (totalActiveUsed >= tierConfig.maxBooks) {
      return res.status(400).json({
        message: `Limit reached: You have ${totalActiveUsed} active requests/books (Max ${tierConfig.maxBooks} on ${tierConfig.name} plan). Return an issued book, wait for pending requests to be reviewed/cancelled, or upgrade your plan.`,
      });
    }
  }

  // GATE 2: Due date within tier check
  assertDueWithinTier(neededUntil, tierConfig);

  // GATE 3: Reason validation
  if (!validateReason(reason, res)) return;

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

  // Librarians ko notification bhejo
  notifyLibrarians({
    title: "New Book Request",
    message: `${user.name} submitted a request for "${book.title}".`,
    type: "info",
    link: "/librarian/requests",
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

// PATCH /api/purchase-requests/:id (purchaser)
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

  if (!validateReason(reason, res)) return;

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
  if (!existing) return res.status(404).json({ message: "Counter offered request not found" });

  existing.neededUntil = existing.proposedDate;
  existing.proposedDate = null;
  existing.status = "pending";
  existing.reviewNote = existing.reviewNote
    ? `${existing.reviewNote} (Accepted proposed date by user)`
    : "Accepted proposed date by user";
  await existing.save();

  res.json(existing);
};

// DELETE /api/purchase-requests/:id (purchaser)
export const cancelRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;

  const deleted = await PurchaseRequest.findOneAndDelete({
    _id: req.params.id,
    requestedBy: req.user.id,
    status: { $in: ["pending", "counter_offered"] },
  });
  if (!deleted) return res.status(404).json({ message: "Pending request not found" });

  // Auto-clean librarian's notification
  await Notification.updateMany(
    { title: "New Book Request", link: "/librarian/requests", read: false },
    { read: true }
  );

  res.json({ message: "Request cancelled" });
};

// GET /api/purchase-requests (librarian)
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
    "name membership"
  );
  if (!existing) return res.status(404).json({ message: "Request not found" });
  if (!["pending", "counter_offered"].includes(existing.status)) {
    return res.status(409).json({ message: "Request already reviewed" });
  }

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
    proposed.setHours(23, 59, 59, 0);

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
    { _id: existing._id, status: existing.status },
    update,
    { new: true }
  );
  if (!updated) return res.status(409).json({ message: "Request already reviewed" });

  // 1. Purchaser ko notification bhejo
  const statusLabels = {
    approved: "Approved",
    rejected: "Rejected",
    counter_offered: "Counter-Offered",
  };

  sendNotification({
    userId: existing.requestedBy?._id || existing.requestedBy,
    title: `Request ${statusLabels[status] || status}`,
    message: `Your request for "${existing.title}" has been ${statusLabels[status]?.toLowerCase() || status}.`,
    type: status === "approved" ? "success" : status === "rejected" ? "danger" : "warning",
    link: "/purchaser/requests",
  });

  // 2. Librarian side: Auto-resolve pending notification
  await Notification.updateMany(
    { title: "New Book Request", link: "/librarian/requests", read: false },
    { read: true }
  );

  res.json(updated);
};
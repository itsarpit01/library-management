import mongoose from "mongoose";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import PurchaseRequest from "../models/PurchaseRequest.js";

export const getLibrarianStats = async (req, res) => {
  const now = new Date();
  const overdueFilter = { status: "issued", dueDate: { $lt: now } };

  const [
    bookTotals,
    issuedCount,
    overdueCount,
    pendingRequests,
    recentIssues,
    overdueIssues,
  ] = await Promise.all([
    Book.aggregate([
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalCopies: { $sum: "$totalCopies" },
          availableCopies: { $sum: "$availableCopies" },
        },
      },
    ]),
    Issue.countDocuments({ status: "issued" }),
    Issue.countDocuments(overdueFilter),
    PurchaseRequest.countDocuments({ status: "pending" }),
    Issue.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("book", "title author")
      .populate("member", "name email"),
    Issue.find(overdueFilter)
      .sort({ dueDate: 1 })
      .limit(5)
      .populate("book", "title author")
      .populate("member", "name email"),
  ]);

  const totals = bookTotals[0] || {
    totalTitles: 0,
    totalCopies: 0,
    availableCopies: 0,
  };

  res.json({
    books: {
      totalTitles: totals.totalTitles,
      totalCopies: totals.totalCopies,
      availableCopies: totals.availableCopies,
    },
    issues: { issuedCount, overdueCount },
    purchaseRequests: { pending: pendingRequests },
    recentIssues,
    overdueIssues,
  });
};

export const getPurchaserStats = async (req, res) => {
  const grouped = await PurchaseRequest.aggregate([
  
    { $match: { requestedBy: new mongoose.Types.ObjectId(req.user.id) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const counts = { pending: 0, approved: 0, rejected: 0 };
  grouped.forEach((g) => (counts[g._id] = g.count));

  res.json({
    purchaseRequests: {
      ...counts,
      total: counts.pending + counts.approved + counts.rejected,
    },
  });
};
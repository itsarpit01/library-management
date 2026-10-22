import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import { calcFine, withOverdueInfo } from "../utils/fine.js";
import { createIssue, reissueIssue, populateIssue, httpError } from "../services/issueService.js";
import { MAX_REISSUES } from "../utils/dates.js";

// POST /api/issues (librarian) body: { bookId, memberId, dueDate, requestId? }
export const issueBook = async (req, res) => {
  const { bookId, memberId, dueDate, requestId } = req.body;
  const issue = await createIssue({ bookId, memberId, dueDate, issuedBy: req.user.id });

  if (requestId) {
    await PurchaseRequest.findByIdAndUpdate(requestId, { issue: issue._id });
  } else {
    await PurchaseRequest.findOneAndUpdate(
      { requestedBy: memberId, book: bookId, status: "approved", issue: { $exists: false } },
      { issue: issue._id }
    );
  }

  res.status(201).json(withOverdueInfo(issue));
};

// PATCH /api/issues/:id/request-reissue (purchaser) body: { dueDate }
export const requestReissue = async (req, res) => {
  const { dueDate } = req.body;
  const issue = await Issue.findOne({ _id: req.params.id, member: req.user.id });

  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (issue.status !== "issued") {
    return res.status(400).json({ message: "Only currently issued books can be reissued" });
  }
  if ((issue.reissueCount || 0) >= MAX_REISSUES) {
    return res.status(400).json({ message: `Maximum reissue limit (${MAX_REISSUES}) reached` });
  }

  issue.reissueRequested = true;
  issue.reissueRequestedDate = new Date(dueDate);
  await issue.save();

  const populated = await populateIssue(Issue.findById(issue._id));
  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/reissue (librarian) body: { dueDate }
export const reissue = async (req, res) => {
  const issue = await reissueIssue({ issueId: req.params.id, dueDate: req.body.dueDate });
  
  await Issue.findByIdAndUpdate(req.params.id, {
    reissueRequested: false,
    reissueRequestedDate: null,
  });

  res.json(withOverdueInfo(issue));
};

// PATCH /api/issues/:id/return (librarian ya purchaser apna)
export const returnBook = async (req, res) => {
  const query = { _id: req.params.id };
  // Agar purchaser hai toh sirf apni hi book return kar sake
  if (req.user.role === "purchaser") {
    query.member = req.user.id;
  }

  const issue = await Issue.findOne(query);
  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (issue.status === "returned") {
    return res.status(400).json({ message: "Book already returned" });
  }

  const now = new Date();

  const updated = await Issue.findOneAndUpdate(
    { _id: issue._id, status: "issued" },
    { status: "returned", returnDate: now, fine: calcFine(issue.dueDate, now), reissueRequested: false },
    { new: true }
  );
  if (!updated) return res.status(400).json({ message: "Book already returned" });

  await Book.findByIdAndUpdate(issue.book, { $inc: { availableCopies: 1 } });

  const populated = await populateIssue(Issue.findById(updated._id));
  res.json(withOverdueInfo(populated));
};

// GET /api/issues?status=issued|returned|overdue (librarian)
export const getIssues = async (req, res) => {
  const { status } = req.query;
  const filter = {};

  if (status === "issued" || status === "returned") filter.status = status;
  if (status === "overdue") {
    filter.status = "issued";
    filter.dueDate = { $lt: new Date() };
  }

  const issues = await populateIssue(Issue.find(filter).sort({ createdAt: -1 }));
  res.json(issues.map(withOverdueInfo));
};

// GET /api/issues/my (purchaser)
export const getMyIssues = async (req, res) => {
  const issues = await populateIssue(
    Issue.find({ member: req.user.id }).sort({ createdAt: -1 })
  );
  res.json(issues.map(withOverdueInfo));
};
import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import { calcFine, withOverdueInfo } from "../utils/fine.js";
import { createIssue, reissueIssue, populateIssue } from "../services/issueService.js";

// POST /api/issues (librarian) body: { bookId, memberId, dueDate }
export const issueBook = async (req, res) => {
  const { bookId, memberId, dueDate } = req.body;
  const issue = await createIssue({ bookId, memberId, dueDate, issuedBy: req.user.id });
  res.status(201).json(withOverdueInfo(issue));
};

// PATCH /api/issues/:id/reissue (librarian) body: { dueDate }
export const reissue = async (req, res) => {
  const issue = await reissueIssue({ issueId: req.params.id, dueDate: req.body.dueDate });
  res.json(withOverdueInfo(issue));
};

// PATCH /api/issues/:id/return (librarian)
export const returnBook = async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (issue.status === "returned") {
    return res.status(400).json({ message: "Book already returned" });
  }

  const now = new Date();

  // status: "issued" condition se double return nahi hoga
  const updated = await Issue.findOneAndUpdate(
    { _id: issue._id, status: "issued" },
    { status: "returned", returnDate: now, fine: calcFine(issue.dueDate, now) },
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
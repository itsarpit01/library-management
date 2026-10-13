import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import { calcFine, withOverdueInfo } from "../utils/fine.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const populateIssue = (query) =>
  query
    .populate("book", "title author isbn")
    .populate("member", "name email")
    .populate("issuedBy", "name");

// POST /api/issues (librarian)
export const issueBook = async (req, res) => {
  const { bookId, memberId } = req.body;
  const days = req.body.days ?? 14;

  const member = await User.findById(memberId);
  if (!member || member.role !== "purchaser") {
    return res.status(404).json({ message: "Member not found" });
  }

  const already = await Issue.findOne({
    book: bookId,
    member: memberId,
    status: "issued",
  });
  if (already) {
    return res
      .status(400)
      .json({ message: "This member already has this book issued" });
  }

  // Atomic: copy tabhi kam hogi jab availableCopies > 0 ho
  const book = await Book.findOneAndUpdate(
    { _id: bookId, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );

  if (!book) {
    const exists = await Book.exists({ _id: bookId });
    return res
      .status(exists ? 400 : 404)
      .json({ message: exists ? "No copies available" : "Book not found" });
  }

  try {
    const issue = await Issue.create({
      book: bookId,
      member: memberId,
      issuedBy: req.user.id,
      dueDate: new Date(Date.now() + days * DAY_MS),
    });

    const populated = await populateIssue(Issue.findById(issue._id));
    res.status(201).json(withOverdueInfo(populated));
  } catch (err) {
    // Issue na bane to copy wapas jodo (rollback), error errorHandler ko jayega
    await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });
    throw err;
  }
};

// PATCH /api/issues/:id/return (librarian)
export const returnBook = async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    return res.status(404).json({ message: "Issue record not found" });
  }
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
  if (!updated) {
    return res.status(400).json({ message: "Book already returned" });
  }

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

  const issues = await populateIssue(
    Issue.find(filter).sort({ createdAt: -1 })
  );
  res.json(issues.map(withOverdueInfo));
};

// GET /api/issues/my (purchaser: sirf apni)
export const getMyIssues = async (req, res) => {
  const issues = await populateIssue(
    Issue.find({ member: req.user.id }).sort({ createdAt: -1 })
  );
  res.json(issues.map(withOverdueInfo));
};
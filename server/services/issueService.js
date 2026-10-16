import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import { MAX_REISSUES } from "../utils/dates.js";

export const httpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

export const populateIssue = (query) =>
  query
    .populate("book", "title author isbn")
    .populate("member", "name email")
    .populate("issuedBy", "name");

// Librarian ka seedha issue aur borrow request approve, dono yahi use karte hain
export async function createIssue({ bookId, memberId, dueDate, issuedBy }) {
  const member = await User.findById(memberId);
  if (!member || member.role !== "purchaser") throw httpError(404, "Member not found");

  const already = await Issue.findOne({ book: bookId, member: memberId, status: "issued" });
  if (already) throw httpError(400, "This member already has this book issued");

  // Atomic: copy tabhi kam hogi jab availableCopies > 0 ho
  const book = await Book.findOneAndUpdate(
    { _id: bookId, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );
  if (!book) {
    const exists = await Book.exists({ _id: bookId });
    throw httpError(exists ? 400 : 404, exists ? "No copies available" : "Book not found");
  }

  try {
    const issue = await Issue.create({ book: bookId, member: memberId, issuedBy, dueDate });
    return await populateIssue(Issue.findById(issue._id));
  } catch (err) {
    // Issue na bane to copy wapas jodo
    await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });
    throw err;
  }
}

export async function reissueIssue({ issueId, dueDate }) {
  const issue = await Issue.findById(issueId);
  if (!issue) throw httpError(404, "Issue record not found");
  if (issue.status !== "issued") throw httpError(400, "Book already returned");

  const now = new Date();
  if (issue.dueDate < now) {
    throw httpError(400, "Overdue books must be returned first (fine applies)");
  }
  if ((issue.reissueCount || 0) >= MAX_REISSUES) {
    throw httpError(400, `Reissue limit (${MAX_REISSUES}) reached`);
  }
  if (dueDate <= issue.dueDate) {
    throw httpError(400, "New due date must be after the current due date");
  }

  // Atomic: reissueCount missing ho (purani issues) tab bhi chalta hai
  const updated = await Issue.findOneAndUpdate(
    {
      _id: issue._id,
      status: "issued",
      dueDate: { $gte: now },
      reissueCount: { $not: { $gte: MAX_REISSUES } },
    },
    { $set: { dueDate }, $inc: { reissueCount: 1 } },
    { new: true }
  );
  if (!updated) throw httpError(409, "Issue changed, please try again");

  return populateIssue(Issue.findById(updated._id));
}
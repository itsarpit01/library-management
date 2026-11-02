import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Notification from "../models/Notification.js";
import { calcFine, withOverdueInfo } from "../utils/fine.js";
import { createIssue, reissueIssue, populateIssue } from "../services/issueService.js";
import { MAX_REISSUES } from "../utils/dates.js";
import { sendNotification, notifyLibrarians } from "./notificationController.js";

const formatDateStr = (date) => (date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

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

  const populated = await populateIssue(Issue.findById(issue._id));

  sendNotification({
    userId: memberId,
    title: "Book Issued",
    message: `"${populated.book?.title || 'Book'}" has been issued to you. Due date: ${formatDateStr(dueDate)}.`,
    type: "success",
    link: "/purchaser/my-issues",
  });

  res.status(201).json(withOverdueInfo(populated));
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
  const memberName = populated.member?.name || "A member";

  notifyLibrarians({
    title: "New Reissue Request",
    message: `${memberName} requested reissue for "${populated.book?.title || 'Book'}" until ${formatDateStr(dueDate)}.`,
    type: "warning",
    link: "/librarian/requests",
  });

  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/cancel-reissue (purchaser cancels pending reissue request)
export const cancelReissue = async (req, res) => {
  const issue = await Issue.findOne({ _id: req.params.id, member: req.user.id });

  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (!issue.reissueRequested) {
    return res.status(400).json({ message: "No pending reissue request found for this book" });
  }

  issue.reissueRequested = false;
  issue.reissueRequestedDate = null;
  await issue.save();

  // Cancel hote hi librarian ke notification card se hatt jayegi!
  await Notification.deleteMany({
    title: "New Reissue Request",
    link: "/librarian/requests",
  });

  const populated = await populateIssue(Issue.findById(issue._id));
  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/reissue (librarian approves reissue) body: { dueDate }
export const reissue = async (req, res) => {
  const issue = await reissueIssue({ issueId: req.params.id, dueDate: req.body.dueDate });
  
  await Issue.findByIdAndUpdate(req.params.id, {
    reissueRequested: false,
    reissueRequestedDate: null,
  });

  const populated = await populateIssue(Issue.findById(issue._id));

  // 1. Purchaser ko notification
  sendNotification({
    userId: populated.member?._id || populated.member,
    title: "Reissue Approved",
    message: `Your reissue request for "${populated.book?.title || 'Book'}" was approved! Extended until: ${formatDateStr(req.body.dueDate)}.`,
    type: "success",
    link: "/purchaser/my-issues",
  });

  // 2. Resolve hote hi Librarian ke notification card se DELETE ho jayegi!
  await Notification.deleteMany({
    title: "New Reissue Request",
    link: "/librarian/requests",
  });

  res.json(withOverdueInfo(issue));
};

// PATCH /api/issues/:id/reject-reissue (librarian rejects reissue request)
export const rejectReissue = async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) return res.status(404).json({ message: "Issue record not found" });
  if (!issue.reissueRequested) {
    return res.status(400).json({ message: "No pending reissue request to reject" });
  }

  issue.reissueRequested = false;
  issue.reissueRequestedDate = null;
  await issue.save();

  const populated = await populateIssue(Issue.findById(issue._id));

  // 1. Purchaser ko notification
  sendNotification({
    userId: populated.member?._id || populated.member,
    title: "Reissue Rejected",
    message: `Your reissue request for "${populated.book?.title || 'Book'}" was rejected. Please return the book on time.`,
    type: "danger",
    link: "/purchaser/my-issues",
  });

  // 2. Reject hote hi Librarian ke notification card se DELETE ho jayegi!
  await Notification.deleteMany({
    title: "New Reissue Request",
    link: "/librarian/requests",
  });

  res.json(withOverdueInfo(populated));
};

// PATCH /api/issues/:id/return (librarian ya purchaser apna)
export const returnBook = async (req, res) => {
  const query = { _id: req.params.id };
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

// GET /api/issues?status=issued|returned|overdue|reissue_requested&reissueRequested=true (librarian)
export const getIssues = async (req, res) => {
  const { status, reissueRequested } = req.query;
  const filter = {};

  if (status === "reissue_requested" || reissueRequested === "true") {
    filter.status = "issued";
    filter.reissueRequested = true;
  } else {
    if (status === "issued" || status === "returned") filter.status = status;
    if (status === "overdue") {
      filter.status = "issued";
      filter.dueDate = { $lt: new Date() };
    }
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
import BorrowRequest from "../models/BorrowRequest.js";
import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import { MAX_REISSUES } from "../utils/dates.js";
import { createIssue, reissueIssue, httpError } from "../services/issueService.js";

const populateReq = (q) =>
  q
    .populate("member", "name email")
    .populate("book", "title author availableCopies")
    .populate("issue", "dueDate reissueCount")
    .populate("reviewedBy", "name");

// POST /api/borrow-requests (purchaser)
export const createRequest = async (req, res) => {
  const { type, dueDate } = req.body;
  const member = req.user.id;
  let doc;

  if (type === "borrow") {
    const book = await Book.findById(req.body.bookId);
    if (!book) throw httpError(404, "Book not found");
    if (book.availableCopies < 1) throw httpError(400, "No copies available right now");

    if (await Issue.exists({ book: book._id, member, status: "issued" })) {
      throw httpError(400, "You already have this book issued");
    }
    if (await BorrowRequest.exists({ member, book: book._id, type: "borrow", status: "pending" })) {
      throw httpError(409, "You already have a pending request for this book");
    }

    doc = await BorrowRequest.create({ type, member, book: book._id, dueDate });
  } else {
    const issue = await Issue.findById(req.body.issueId);
    if (!issue || String(issue.member) !== String(member)) {
      throw httpError(404, "Issue record not found");
    }
    if (issue.status !== "issued") throw httpError(400, "Book already returned");
    if (issue.dueDate < new Date()) {
      throw httpError(400, "Overdue books must be returned first");
    }
    if ((issue.reissueCount || 0) >= MAX_REISSUES) {
      throw httpError(400, `Reissue limit (${MAX_REISSUES}) reached`);
    }
    if (dueDate <= issue.dueDate) {
      throw httpError(400, "New due date must be after the current due date");
    }
    if (await BorrowRequest.exists({ issue: issue._id, type: "reissue", status: "pending" })) {
      throw httpError(409, "A reissue request is already pending for this book");
    }

    doc = await BorrowRequest.create({
      type,
      member,
      book: issue.book,
      issue: issue._id,
      dueDate,
    });
  }

  res.status(201).json(await populateReq(BorrowRequest.findById(doc._id)));
};

// GET /api/borrow-requests/my (purchaser)
export const getMyRequests = async (req, res) => {
  const filter = { member: req.user.id };
  if (req.query.status) filter.status = req.query.status;
  res.json(await populateReq(BorrowRequest.find(filter).sort({ createdAt: -1 })));
};

// DELETE /api/borrow-requests/:id (purchaser, apni pending)
export const cancelRequest = async (req, res) => {
  const deleted = await BorrowRequest.findOneAndDelete({
    _id: req.params.id,
    member: req.user.id,
    status: "pending",
  });
  if (!deleted) throw httpError(404, "Pending request not found");
  res.json({ message: "Request cancelled" });
};

// GET /api/borrow-requests?status= (librarian)
export const getAllRequests = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  res.json(await populateReq(BorrowRequest.find(filter).sort({ createdAt: -1 })));
};

// PATCH /api/borrow-requests/:id/review (librarian)
export const reviewRequest = async (req, res) => {
  const { status, reviewNote } = req.body;

  const request = await BorrowRequest.findById(req.params.id);
  if (!request) throw httpError(404, "Request not found");
  if (request.status !== "pending") throw httpError(409, "Request already reviewed");

  const review = { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote };

  if (status === "rejected") {
    const rejected = await BorrowRequest.findOneAndUpdate(
      { _id: request._id, status: "pending" },
      review,
      { new: true }
    );
    if (!rejected) throw httpError(409, "Request already reviewed");
    return res.json(await populateReq(BorrowRequest.findById(rejected._id)));
  }

  if (request.dueDate <= new Date()) {
    throw httpError(400, "Requested due date has passed. Reject it and ask the member to request again.");
  }

  // Pehle claim karo (double approve nahi hoga), phir issue/reissue karo
  const claimed = await BorrowRequest.findOneAndUpdate(
    { _id: request._id, status: "pending" },
    review,
    { new: true }
  );
  if (!claimed) throw httpError(409, "Request already reviewed");

  try {
    const issue =
      request.type === "borrow"
        ? await createIssue({
            bookId: request.book,
            memberId: request.member,
            dueDate: request.dueDate,
            issuedBy: req.user.id,
          })
        : await reissueIssue({ issueId: request.issue, dueDate: request.dueDate });

    claimed.resultIssue = issue._id;
    await claimed.save();
  } catch (err) {
    // Fail hua to request wapas pending, librarian reason dekh ke dobara try kare
    await BorrowRequest.updateOne(
      { _id: request._id },
      {
        $set: { status: "pending" },
        $unset: { reviewedBy: "", reviewedAt: "", reviewNote: "", resultIssue: "" },
      }
    );
    throw err;
  }

  res.json(await populateReq(BorrowRequest.findById(claimed._id)));
};
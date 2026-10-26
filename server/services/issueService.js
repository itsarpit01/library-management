import Issue from "../models/Issue.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import { MAX_REISSUES, maxDueFor } from "../utils/dates.js";
import { getUserTierConfig } from "../config/membershipConfig.js";

export const httpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

// Tier ke hisaab se due date check (Free: 14d, Premium: 30d, Ultimate: No limit / all upcoming dates)
export const assertDueWithinTier = (dateInput, tierConfig) => {
  if (!dateInput || !tierConfig) return;
  // Ultimate plan me koi upper date limit nahi hai (All upcoming dates allowed)
  if (tierConfig.tier === "ultimate" || tierConfig.maxIssueDays === Infinity) return;

  const maxAllowed = maxDueFor(tierConfig.maxIssueDays);
  const target = new Date(dateInput);
  if (target > maxAllowed) {
    const formattedMax = maxAllowed.toISOString().slice(0, 10);
    throw httpError(
      400,
      `Your ${tierConfig.name} plan allows up to ${tierConfig.maxIssueDays} days (max date: ${formattedMax}). Upgrade to extend your limit.`
    );
  }
};

export const populateIssue = (query) =>
  query
    .populate("book", "title author isbn")
    .populate("member", "name email membership")
    .populate("issuedBy", "name");

// Librarian ka direct issue aur borrow request approve, dono yahi use karte hain
export async function createIssue({ bookId, memberId, dueDate, issuedBy }) {
  const member = await User.findById(memberId);
  if (!member || member.role !== "purchaser") throw httpError(404, "Member not found");

  const tierConfig = getUserTierConfig(member);

  // GATE 1: Active borrowing limit check
  if (tierConfig.maxBooks !== Infinity) {
    const activeCount = await Issue.countDocuments({ member: memberId, status: "issued" });
    if (activeCount >= tierConfig.maxBooks) {
      throw httpError(
        400,
        `Limit reached: ${member.name}'s ${tierConfig.name} plan allows a maximum of ${tierConfig.maxBooks} active issued books.`
      );
    }
  }

  // GATE 2: Plan duration check (Free: 14d, Premium: 30d, Ultimate: all upcoming)
  assertDueWithinTier(dueDate, tierConfig);

  const already = await Issue.findOne({ book: bookId, member: memberId, status: "issued" });
  if (already) throw httpError(400, "This member already has this book issued");

  // Atomic: copy tabhi decrement hogi jab availableCopies > 0 ho
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
    // Agar issue create na ho paaye toh book copy revert karo
    await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });
    throw err;
  }
}

export async function reissueIssue({ issueId, dueDate }) {
  const issue = await Issue.findById(issueId).populate("member");
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

  // Reissue par bhi member ka tier limit verify karo
  if (issue.member) {
    const tierConfig = getUserTierConfig(issue.member);
    assertDueWithinTier(dueDate, tierConfig);
  }

  // Atomic: update dueDate, increment count aur pending reissue request flag clear karo
  const updated = await Issue.findOneAndUpdate(
    {
      _id: issue._id,
      status: "issued",
      dueDate: { $gte: now },
      reissueCount: { $not: { $gte: MAX_REISSUES } },
    },
    {
      $set: {
        dueDate,
        reissueRequested: false,
        reissueRequestedDate: null,
      },
      $inc: { reissueCount: 1 },
    },
    { new: true }
  );
  if (!updated) throw httpError(409, "Issue changed, please try again");

  return populateIssue(Issue.findById(updated._id));
}
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import { calcFine } from "../utils/fine.js";
import { sendNotification } from "../controllers/notificationController.js";

const formatDateStr = (date) => (date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

// 1. Check books due tomorrow (24h reminder)
const checkUpcomingDueDates = async () => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Books due between now and tomorrow (not yet overdue)
    const upcomingIssues = await Issue.find({
      status: "issued",
      dueDate: { $gte: now, $lte: tomorrow },
    }).populate("book member");

    for (const issue of upcomingIssues) {
      if (issue.member?._id && issue.book) {
        await sendNotification({
          userId: issue.member._id,
          title: "Book Due Tomorrow",
          message: `Reminder: "${issue.book.title}" is due tomorrow (${formatDateStr(issue.dueDate)}). Please return or request a reissue.`,
          type: "warning",
          link: "/purchaser/my-issues",
        });
      }
    }
    console.log(`[Recurring] Checked upcoming dues: notified ${upcomingIssues.length} member(s)`);
  } catch (err) {
    console.error("[Recurring] checkUpcomingDueDates error:", err);
  }
};

// 2. Check overdue books & sync daily fines
const checkOverdueBooksAndFines = async () => {
  try {
    const now = new Date();
    const overdueIssues = await Issue.find({
      status: "issued",
      dueDate: { $lt: now },
    }).populate("book member");

    for (const issue of overdueIssues) {
      const currentFine = calcFine(issue.dueDate, now);
      if (currentFine !== issue.fine) {
        issue.fine = currentFine;
        await issue.save();
      }

      if (issue.member?._id && issue.book) {
        await sendNotification({
          userId: issue.member._id,
          title: "Book Overdue Alert",
          message: `"${issue.book.title}" is overdue! Current fine: INR ${currentFine}. Please return it immediately.`,
          type: "danger",
          link: "/purchaser/my-issues",
        });
      }
    }
    console.log(`[Recurring] Processed ${overdueIssues.length} overdue issue(s)`);
  } catch (err) {
    console.error("[Recurring] checkOverdueBooksAndFines error:", err);
  }
};

// 3. Check membership plans expiry
const checkMembershipExpiries = async () => {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      "membership.tier": { $in: ["premium", "ultimate"] },
      "membership.expiresAt": { $lt: now },
    });

    for (const u of expiredUsers) {
      const oldTier = u.membership.tier;
      u.membership.tier = "free";
      u.membership.expiresAt = null;
      await u.save();

      await sendNotification({
        userId: u._id,
        title: "Membership Expired",
        message: `Your ${oldTier.toUpperCase()} membership has expired and your plan has reverted to the Free tier.`,
        type: "info",
        link: "/purchaser",
      });
    }
    console.log(`[Recurring] Expired ${expiredUsers.length} membership plan(s)`);
  } catch (err) {
    console.error("[Recurring] checkMembershipExpiries error:", err);
  }
};

// Main Runner: Server start par ek baar, aur har 1 ghante me recurring
export const startRecurringJobs = () => {
  console.log("[Recurring] Background Automation Service Initialized");

  const runAllJobs = async () => {
    console.log("[Recurring] Running scheduled recurring checks...");
    await checkUpcomingDueDates();
    await checkOverdueBooksAndFines();
    await checkMembershipExpiries();
    console.log("[Recurring] Scheduled checks complete.");
  };

  // 1. Server start hone ke 5 sec baad run karega
  setTimeout(runAllJobs, 5000);

  // 2. Har 1 ghante (3600000 ms) me background me automatically chalega
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(runAllJobs, ONE_HOUR);
};
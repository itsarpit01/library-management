import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/User.js";
import Issue from "../models/Issue.js";
import Transaction from "../models/Transaction.js";
import { calcFine, withOverdueInfo } from "../utils/fine.js";

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay API keys are not configured in environment variables");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const PLAN_DETAILS = {
  premium: { amount: 499, months: 6 },
  ultimate: { amount: 999, months: 12 },
};

/**
 * Model B: Prorated Calculation Helper
 */
const calculateProratedAmount = (user, targetTier) => {
  const targetPlan = PLAN_DETAILS[targetTier];
  if (!targetPlan) return { payableAmount: 0, credit: 0, remainingDays: 0 };

  const currentTier = user?.membership?.tier;
  const expiresAt = user?.membership?.expiresAt;

  if (
    targetTier === "ultimate" &&
    currentTier === "premium" &&
    expiresAt &&
    new Date(expiresAt) > new Date()
  ) {
    const currentPlan = PLAN_DETAILS.premium;
    const totalDays = currentPlan.months * 30;
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    const unusedRatio = Math.min(1, Math.max(0, remainingDays / totalDays));
    const credit = Math.round(currentPlan.amount * unusedRatio);
    const payableAmount = Math.max(1, targetPlan.amount - credit);

    return {
      payableAmount,
      credit,
      remainingDays,
    };
  }

  return {
    payableAmount: targetPlan.amount,
    credit: 0,
    remainingDays: 0,
  };
};

// 1. Create Razorpay Order for Membership Plans
export const createOrder = async (req, res) => {
  try {
    const { tier } = req.body;
    if (!tier || !PLAN_DETAILS[tier]) {
      return res.status(400).json({ message: "Invalid membership tier selected" });
    }

    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { payableAmount } = calculateProratedAmount(user, tier);
    const razorpay = getRazorpayInstance();
    const receipt = `rcpt_${userId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;

    const options = {
      amount: payableAmount * 100,
      currency: "INR",
      receipt,
      notes: {
        userId: userId.toString(),
        tier,
        type: "membership",
      },
    };

    const order = await razorpay.orders.create(options);

    await Transaction.create({
      user: userId,
      orderId: order.id,
      amount: payableAmount,
      type: "membership",
      tier,
      currency: order.currency,
      status: "pending",
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      tier,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
};

// 2. Client-side Verification Callback for Membership Plans
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, tier } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !tier) {
      return res.status(400).json({ message: "Missing required payment verification details" });
    }

    const plan = PLAN_DETAILS[tier];
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const userId = req.user?.id || req.user?._id;
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Transaction.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: "failed", failureReason: "Invalid cryptographic signature" }
      );
      return res.status(400).json({ message: "Invalid payment signature. Verification failed." });
    }

    const existingTx = await Transaction.findOne({ orderId: razorpay_order_id });
    if (existingTx && existingTx.status === "success") {
      const user = await User.findById(userId).select("-password");
      return res.status(200).json({ message: "Plan already upgraded!", user });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.months);

    await Transaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        status: "success",
        startDate,
        endDate,
      },
      { upsert: true }
    );

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        membership: {
          tier,
          startedAt: startDate,
          expiresAt: endDate,
        },
      },
      { new: true }
    ).select("-password");

    res.status(200).json({
      message: `Successfully upgraded to ${tier.toUpperCase()} Plan!`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: error.message || "Failed to verify payment" });
  }
};

// 3. Create Razorpay Order for Late Fine
export const createFineOrder = async (req, res) => {
  try {
    const { issueId } = req.body;
    if (!issueId) {
      return res.status(400).json({ message: "issueId is required" });
    }

    const userId = req.user?.id || req.user?._id;
    const issue = await Issue.findOne({ _id: issueId, member: userId }).populate("book", "title");
    if (!issue) {
      return res.status(404).json({ message: "Issue record not found" });
    }

    if (issue.finePaid) {
      return res.status(400).json({ message: "Fine for this book has already been paid" });
    }

    const fineAmount = issue.status === "returned" ? issue.fine : calcFine(issue.dueDate);
    if (!fineAmount || fineAmount <= 0) {
      return res.status(400).json({ message: "No fine due on this book" });
    }

    const razorpay = getRazorpayInstance();
    const receipt = `fine_${issue._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;

    const options = {
      amount: fineAmount * 100, // in paise
      currency: "INR",
      receipt,
      notes: {
        userId: userId.toString(),
        issueId: issue._id.toString(),
        type: "fine",
        bookTitle: issue.book?.title || "Book",
      },
    };

    const order = await razorpay.orders.create(options);

    await Transaction.create({
      user: userId,
      orderId: order.id,
      amount: fineAmount,
      type: "fine",
      tier: "fine",
      issue: issue._id,
      bookTitle: issue.book?.title || "Book",
      currency: order.currency,
      status: "pending",
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      fine: fineAmount,
      bookTitle: issue.book?.title || "Book",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Fine order creation error:", error);
    res.status(500).json({ message: error.message || "Failed to create fine payment order" });
  }
};

// 4. Verify Razorpay Payment for Late Fine
export const verifyFinePayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, issueId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !issueId) {
      return res.status(400).json({ message: "Missing required fine verification details" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Transaction.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: "failed", failureReason: "Invalid cryptographic signature" }
      );
      return res.status(400).json({ message: "Invalid payment signature. Verification failed." });
    }

    const tx = await Transaction.findOne({ orderId: razorpay_order_id });
    const fineAmount = tx ? tx.amount : 0;

    await Transaction.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        status: "success",
      },
      { upsert: true }
    );

    const updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      {
        finePaid: true,
        finePaymentId: razorpay_payment_id,
        finePaidAt: new Date(),
        fine: fineAmount,
      },
      { new: true }
    ).populate("book", "title author");

    res.status(200).json({
      message: `Late fine of ₹${fineAmount} paid successfully!`,
      issue: withOverdueInfo(updatedIssue),
    });
  } catch (error) {
    console.error("Fine verification error:", error);
    res.status(500).json({ message: error.message || "Failed to verify fine payment" });
  }
};

// 5. Mark Order Failed
export const markPaymentFailed = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    await Transaction.findOneAndUpdate(
      { orderId, status: "pending" },
      {
        status: "failed",
        failureReason: reason || "User cancelled payment or closed popup",
      }
    );

    res.status(200).json({ message: "Payment marked as failed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update transaction status" });
  }
};

// 6. Razorpay Webhook
export const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({ message: "Webhook secret is not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const type = paymentEntity.notes?.type || "membership";

      if (type === "fine") {
        const issueId = paymentEntity.notes?.issueId;
        await Transaction.findOneAndUpdate(
          { orderId },
          { paymentId, status: "success" },
          { upsert: true }
        );
        if (issueId) {
          await Issue.findByIdAndUpdate(issueId, {
            finePaid: true,
            finePaymentId: paymentId,
            finePaidAt: new Date(),
          });
        }
      } else {
        const tier = paymentEntity.notes?.tier || "premium";
        const userId = paymentEntity.notes?.userId;
        const plan = PLAN_DETAILS[tier] || PLAN_DETAILS.premium;

        const existingTx = await Transaction.findOne({ orderId });
        if (!existingTx || existingTx.status !== "success") {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + plan.months);

          await Transaction.findOneAndUpdate(
            { orderId },
            {
              user: userId,
              tier,
              amount: paymentEntity.amount / 100,
              paymentId,
              status: "success",
              startDate,
              endDate,
            },
            { upsert: true }
          );

          if (userId) {
            await User.findByIdAndUpdate(userId, {
              membership: { tier, startedAt: startDate, expiresAt: endDate },
            });
          }
        }
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const errorDesc = paymentEntity.error_description || "Payment failed at bank";

      await Transaction.findOneAndUpdate(
        { orderId },
        { status: "failed", failureReason: errorDesc }
      );
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ message: "Internal webhook error" });
  }
};

// 7. Get Current User's Transaction History
export const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);

    await Transaction.updateMany(
      {
        user: userId,
        status: "pending",
        createdAt: { $lt: oneMinuteAgo },
      },
      {
        status: "failed",
        failureReason: "Payment session closed or abandoned",
      }
    );

    const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};
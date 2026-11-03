import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

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
 * Calculates unused days credit when upgrading from active Premium to Ultimate
 */
const calculateProratedAmount = (user, targetTier) => {
  const targetPlan = PLAN_DETAILS[targetTier];
  if (!targetPlan) return { payableAmount: 0, credit: 0, remainingDays: 0 };

  const currentTier = user?.membership?.tier;
  const expiresAt = user?.membership?.expiresAt;

  // Prorated credit applies only when upgrading from active Premium to Ultimate
  if (
    targetTier === "ultimate" &&
    currentTier === "premium" &&
    expiresAt &&
    new Date(expiresAt) > new Date()
  ) {
    const currentPlan = PLAN_DETAILS.premium;
    const totalDays = currentPlan.months * 30; // 180 days for 6 months
    const remainingMs = new Date(expiresAt).getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    // Ratio between 0 and 1
    const unusedRatio = Math.min(1, Math.max(0, remainingDays / totalDays));
    const credit = Math.round(currentPlan.amount * unusedRatio);
    const payableAmount = Math.max(1, targetPlan.amount - credit);

    return {
      payableAmount,
      credit,
      remainingDays,
      originalPrice: targetPlan.amount,
    };
  }

  // Normal upgrade for free or expired members
  return {
    payableAmount: targetPlan.amount,
    credit: 0,
    remainingDays: 0,
    originalPrice: targetPlan.amount,
  };
};

// 1. Create Order & Save Pending Transaction in DB (with Model B Prorated Calculation)
export const createOrder = async (req, res) => {
  try {
    const { tier } = req.body;
    const plan = PLAN_DETAILS[tier];

    if (!plan) {
      return res.status(400).json({ message: "Invalid membership plan selected" });
    }

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Model B Prorated calculation
    const { payableAmount, credit, remainingDays, originalPrice } = calculateProratedAmount(
      user,
      tier
    );

    const razorpay = getRazorpayInstance();

    const options = {
      amount: payableAmount * 100, // Amount in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${String(userId).slice(-4)}`,
      notes: {
        userId: String(userId),
        tier,
        credit: String(credit),
        remainingDays: String(remainingDays),
      },
    };

    const order = await razorpay.orders.create(options);

    // Save initial PENDING transaction in DB with prorated details
    await Transaction.create({
      user: userId,
      orderId: order.id,
      tier,
      amount: payableAmount,
      currency: "INR",
      status: "pending",
      metadata: {
        originalPrice,
        credit,
        remainingDays,
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      payableAmount,
      credit,
      remainingDays,
      currency: order.currency,
      tier,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
};

// 2. Client-side Verification Callback
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

    // Cryptographic HMAC-SHA256 signature check
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

    // Check if already processed (Idempotency check)
    const existingTx = await Transaction.findOne({ orderId: razorpay_order_id });
    if (existingTx && existingTx.status === "success") {
      const user = await User.findById(userId).select("-password");
      return res.status(200).json({ message: "Plan already upgraded!", user });
    }

    // Dates calculation for new upgraded tier
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.months);

    // Update Transaction to SUCCESS
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

    // Update User in Database
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
      message: `Successfully upgraded to ${tier.toUpperCase()} plan!`,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        membership: updatedUser.membership,
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: error.message || "Payment verification failed" });
  }
};

// 3. Mark Payment as Failed (Client fail sync)
export const markPaymentFailed = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "Order ID required" });
    }

    await Transaction.findOneAndUpdate(
      { orderId },
      {
        status: "failed",
        failureReason: reason || "Payment failed or declined by bank",
      }
    );

    res.status(200).json({ message: "Transaction marked as failed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update transaction status" });
  }
};

// 4. Razorpay Server-to-Server Webhook Handler
export const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!webhookSecret || !signature) {
      return res.status(400).json({ message: "Webhook secret or signature missing" });
    }

    // Verify Webhook Signature with raw body
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("Invalid webhook signature received");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
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
            membership: {
              tier,
              startedAt: startDate,
              expiresAt: endDate,
            },
          });
        }
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const errorDesc = paymentEntity.error_description || "Payment failed at bank";

      await Transaction.findOneAndUpdate(
        { orderId },
        {
          status: "failed",
          failureReason: errorDesc,
        }
      );
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ message: "Internal webhook error" });
  }
};

// 5. Get Current User's Transaction History
export const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};
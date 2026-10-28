import Razorpay from "razorpay";
import crypto from "crypto";
import User from "../models/User.js";

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay API keys are not configured in environment variables");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// Plan config (price in INR and validity duration)
const PLAN_DETAILS = {
  premium: {
    amount: 499,
    months: 6,
  },
  ultimate: {
    amount: 999,
    months: 12,
  },
};

// 1. Create Razorpay Order
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

    const razorpay = getRazorpayInstance();

    // Razorpay amount is always in paise (1 INR = 100 paise)
    const options = {
      amount: plan.amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${String(userId).slice(-4)}`,
      notes: {
        userId: String(userId),
        tier,
      },
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      tier,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
};

// 2. Verify Payment & Upgrade Membership
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
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Cryptographic signature check
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature. Verification failed." });
    }

    // Calculate expiry date
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + plan.months);

    // Update user in Database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        membership: {
          tier,
          expiresAt,
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
    console.error("Razorpay verification error:", error);
    res.status(500).json({ message: error.message || "Payment verification failed" });
  }
};
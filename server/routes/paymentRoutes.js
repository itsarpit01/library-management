import express from "express";
import {
  createOrder,
  verifyPayment,
  markPaymentFailed,
  handleWebhook,
  getMyTransactions,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Public Webhook (Razorpay Server call karega, ispar JWT protect nahi lagta)
router.post("/webhook", handleWebhook);

// 2. Protected User Endpoints (JWT Token required)
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.post("/mark-failed", protect, markPaymentFailed);
router.get("/my-transactions", protect, getMyTransactions);

export default router;
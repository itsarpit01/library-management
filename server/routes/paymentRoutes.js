import express from "express";
import {
  createOrder,
  verifyPayment,
  createFineOrder,
  verifyFinePayment,
  markPaymentFailed,
  handleWebhook,
  getMyTransactions,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Webhook (Razorpay Server)
router.post("/webhook", handleWebhook);

// Protected Membership Endpoints
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);

// Protected Late Fine Endpoints
router.post("/create-fine-order", protect, createFineOrder);
router.post("/verify-fine", protect, verifyFinePayment);

// Payment Session Tracking
router.post("/mark-failed", protect, markPaymentFailed);
router.get("/my-transactions", protect, getMyTransactions);

export default router;
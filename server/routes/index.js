import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import authRoutes from "./authRoutes.js";
import bookRoutes from "./bookRoutes.js";
import issueRoutes from "./issueRoutes.js";
import userRoutes from "./userRoutes.js";
import purchaseRequestRoutes from "./purchaseRequestRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import paymentRoutes from "./paymentRoutes.js"; // <- Add this import

const router = express.Router();

// Public group
router.use("/auth", authRoutes);

// Protected routes
router.use(protect);
router.use("/books", bookRoutes);
router.use("/issues", issueRoutes);
router.use("/users", userRoutes);
router.use("/purchase-requests", purchaseRequestRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/payment", paymentRoutes); // <- Add this route

export default router;
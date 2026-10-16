import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import authRoutes from "./authRoutes.js";
import bookRoutes from "./bookRoutes.js";
import issueRoutes from "./issueRoutes.js";
import userRoutes from "./userRoutes.js";
import purchaseRequestRoutes from "./purchaseRequestRoutes.js";
import borrowRequestRoutes from "./borrowRequestRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = express.Router();

// Public group: login, register, forgot/reset password, logout
// (/auth/me par protect authRoutes.js ke andar alag se laga hai)
router.use("/auth", authRoutes);

// Is line ke baad ke sab routes protected hain
router.use(protect);

router.use("/books", bookRoutes);
router.use("/issues", issueRoutes);
router.use("/users", userRoutes);
router.use("/purchase-requests", purchaseRequestRoutes);
router.use("/borrow-requests", borrowRequestRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
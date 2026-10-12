import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import authRoutes from "./authRoutes.js";
import bookRoutes from "./bookRoutes.js";
import issueRoutes from "./issueRoutes.js";
import userRoutes from "./userRoutes.js";
import purchaseRequestRoutes from "./purchaseRequestRoutes.js";

const router = express.Router();

// Public routes (login/register)
router.use("/auth", authRoutes);

// Is line ke baad ke sab routes protected hain
router.use(protect);

router.use("/books", bookRoutes);
router.use("/issues", issueRoutes);
router.use("/users", userRoutes);
router.use("/purchase-requests", purchaseRequestRoutes);

export default router;
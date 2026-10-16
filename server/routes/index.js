import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import authRoutes from "./authRoutes.js";
import bookRoutes from "./bookRoutes.js";
import issueRoutes from "./issueRoutes.js";
import userRoutes from "./userRoutes.js";
import purchaseRequestRoutes from "./purchaseRequestRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = express.Router();

// Public group (/auth/me par protect authRoutes.js ke andar hai)
router.use("/auth", authRoutes);

// Is line ke baad sab protected
router.use(protect);

router.use("/books", bookRoutes);
router.use("/issues", issueRoutes);
router.use("/users", userRoutes);
router.use("/purchase-requests", purchaseRequestRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
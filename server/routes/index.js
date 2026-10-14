import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import authRoutes from "./authRoutes.js";
import bookRoutes from "./bookRoutes.js";
import issueRoutes from "./issueRoutes.js";
import userRoutes from "./userRoutes.js";
import purchaseRequestRoutes from "./purchaseRequestRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = express.Router();


router.use("/auth", authRoutes);


router.use(protect);

router.use("/books", bookRoutes);
router.use("/issues", issueRoutes);
router.use("/users", userRoutes);
router.use("/purchase-requests", purchaseRequestRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
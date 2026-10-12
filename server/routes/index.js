import express from "express";
import authRoutes from "./authRoutes.js";
import bookRoutes from "./bookRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/books", bookRoutes);

export default router;
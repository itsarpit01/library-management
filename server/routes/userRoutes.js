import express from "express";
import { getMembers } from "../controllers/userController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("librarian"));

router.get("/members", getMembers);

export default router;
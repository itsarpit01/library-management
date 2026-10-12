import express from "express";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getLibrarianStats,
  getPurchaserStats,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/", authorizeRoles("librarian"), getLibrarianStats);
router.get("/my", authorizeRoles("purchaser"), getPurchaserStats);

export default router;
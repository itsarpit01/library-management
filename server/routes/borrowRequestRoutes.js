import express from "express";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createBorrowRequestSchema,
  reviewBorrowRequestSchema,
} from "../validators/borrowRequestValidator.js";
import {
  createRequest,
  getMyRequests,
  cancelRequest,
  getAllRequests,
  reviewRequest,
} from "../controllers/borrowRequestController.js";

const router = express.Router();

// Purchaser (/my, /:id se pehle)
router.post("/", authorizeRoles("purchaser"), validate(createBorrowRequestSchema), createRequest);
router.get("/my", authorizeRoles("purchaser"), getMyRequests);
router.delete("/:id", authorizeRoles("purchaser"), cancelRequest);

// Librarian
router.get("/", authorizeRoles("librarian"), getAllRequests);
router.patch(
  "/:id/review",
  authorizeRoles("librarian"),
  validate(reviewBorrowRequestSchema),
  reviewRequest
);

export default router;
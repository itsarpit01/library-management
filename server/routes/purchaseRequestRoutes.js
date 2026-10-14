import express from "express";
import {
  createRequest,
  getMyRequests,
  cancelRequest,
  getAllRequests,
  reviewRequest,
} from "../controllers/purchaseRequestController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  createRequestSchema,
  reviewRequestSchema,
} from "../validators/purchaseRequestValidator.js";

const router = express.Router();

router.use(protect);

// Purchaser
router.post("/", authorizeRoles("purchaser"), validate(createRequestSchema), createRequest);
router.get("/my", authorizeRoles("purchaser"), getMyRequests);
router.delete("/:id", authorizeRoles("purchaser"), cancelRequest);

// Librarian
router.get("/", authorizeRoles("librarian"), getAllRequests);
router.patch(
  "/:id/review",
  authorizeRoles("librarian"),
  validate(reviewRequestSchema),
  reviewRequest
);

export default router;
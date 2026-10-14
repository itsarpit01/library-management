import express from "express";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {createPurchaseRequestSchema,reviewPurchaseRequestSchema,} from "../validators/purchaseRequestValidator.js";
import {createRequest,getMyRequests,cancelRequest,getAllRequests,  reviewRequest,} from "../controllers/purchaseRequestController.js";

const router = express.Router();

// Purchaser
router.post("/", authorizeRoles("purchaser"), validate(createPurchaseRequestSchema), createRequest);
router.get("/my", authorizeRoles("purchaser"), getMyRequests);
router.delete("/:id", authorizeRoles("purchaser"), cancelRequest);

// Librarian
router.get("/", authorizeRoles("librarian"), getAllRequests);
router.patch("/:id/review", authorizeRoles("librarian"), validate(reviewPurchaseRequestSchema), reviewRequest);

export default router;
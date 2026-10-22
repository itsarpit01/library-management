import express from "express";
import {
  issueBook,
  reissue,
  returnBook,
  getIssues,
  getMyIssues,
  requestReissue,
} from "../controllers/issueController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  issueBookSchema,
  reissueSchema,
  issueIdParamSchema,
} from "../validators/issueValidator.js";

const router = express.Router();

router.use(protect);

// Purchaser routes
router.get("/my", authorizeRoles("purchaser"), getMyIssues);
router.patch(
  "/:id/request-reissue",
  authorizeRoles("purchaser"),
  validate(issueIdParamSchema, "params"),
  validate(reissueSchema),
  requestReissue
);

// Return route: Available to both Librarian & Purchaser (controller guards ownership)
router.patch(
  "/:id/return",
  validate(issueIdParamSchema, "params"),
  returnBook
);

// Librarian specific routes
router.get("/", authorizeRoles("librarian"), getIssues);
router.post("/", authorizeRoles("librarian"), validate(issueBookSchema), issueBook);
router.patch(
  "/:id/reissue",
  authorizeRoles("librarian"),
  validate(issueIdParamSchema, "params"),
  validate(reissueSchema),
  reissue
);

export default router;
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

// Purchaser route
router.get("/my", authorizeRoles("purchaser"), getMyIssues);
router.patch(
  "/:id/request-reissue",
  authorizeRoles("purchaser"),
  validate(issueIdParamSchema, "params"),
  validate(reissueSchema),
  requestReissue
);

// Librarian routes
router.get("/", authorizeRoles("librarian"), getIssues);
router.post("/", authorizeRoles("librarian"), validate(issueBookSchema), issueBook);
router.patch(
  "/:id/reissue",
  authorizeRoles("librarian"),
  validate(issueIdParamSchema, "params"),
  validate(reissueSchema),
  reissue
);
router.patch(
  "/:id/return",
  authorizeRoles("librarian"),
  validate(issueIdParamSchema, "params"),
  returnBook
);

export default router;
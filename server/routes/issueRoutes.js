import express from "express";
import {
  issueBook,
  returnBook,
  getIssues,
  getMyIssues,
} from "../controllers/issueController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { issueBookSchema, issueIdParamSchema } from "../validators/issueValidator.js";

const router = express.Router();

router.use(protect);

// Group 1: purchaser ke liye (apni issues)
router.get("/my", authorizeRoles("purchaser"), getMyIssues);

// Group 2: neeche ke sab routes sirf librarian ke liye
router.use(authorizeRoles("librarian"));

router.route("/").get(getIssues).post(validate(issueBookSchema), issueBook);
router.patch("/:id/return", validate(issueIdParamSchema, "params"), returnBook);

export default router;
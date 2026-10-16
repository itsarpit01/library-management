import express from "express";
import {
  issueBook,
  returnBook,
  reissue,
  getIssues,
  getMyIssues,
} from "../controllers/issueController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  issueBookSchema,
  reissueSchema,
  issueIdParamSchema,
} from "../validators/issueValidator.js";

const router = express.Router();

// Purchaser: apni issues
router.get("/my", authorizeRoles("purchaser"), getMyIssues);

// Neeche ke sab routes sirf librarian ke liye
router.use(authorizeRoles("librarian"));

router.route("/").get(getIssues).post(validate(issueBookSchema), issueBook);
router.patch("/:id/return", validate(issueIdParamSchema, "params"), returnBook);
router.patch(
  "/:id/reissue",
  validate(issueIdParamSchema, "params"),
  validate(reissueSchema),
  reissue
);

export default router;
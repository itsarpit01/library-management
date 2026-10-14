import express from "express";
import {
  issueBook,
  returnBook,
  getIssues,
  getMyIssues,
} from "../controllers/issueController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  issueBookSchema,
  issueIdParamSchema,
} from "../validators/issueValidator.js";

const router = express.Router();


router.get("/my", authorizeRoles("purchaser"), getMyIssues);


router.use(authorizeRoles("librarian"));

router.route("/").get(getIssues).post(validate(issueBookSchema), issueBook);
router.patch(
  "/:id/return",
  validate(issueIdParamSchema, "params"),
  returnBook
);

export default router;
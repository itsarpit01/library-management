import express from "express";
import {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
} from "../controllers/bookController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { createBookSchema, updateBookSchema, idParamSchema } from "../validators/bookValidator.js";

const router = express.Router();

router.use(protect); // is group ke saare routes ke liye login zaroori

router
  .route("/")
  .get(getBooks)
  .post(authorizeRoles("librarian"), validate(createBookSchema), createBook);

router
  .route("/:id")
  .get(validate(idParamSchema, "params"), getBookById)
  .put(
    authorizeRoles("librarian"),
    validate(idParamSchema, "params"),
    validate(updateBookSchema),
    updateBook
  )
  .delete(authorizeRoles("librarian"), validate(idParamSchema, "params"), deleteBook);

export default router;
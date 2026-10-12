import Book from "../models/Book.js";
import Issue from "../models/Issue.js";
import { bookQuerySchema } from "../validators/bookQueryValidator.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/books?search=&category=&author=&available=&sort=&page=&limit=
export const getBooks = async (req, res) => {
  const parsed = bookQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const errors = Object.fromEntries(
      parsed.error.issues.map((i) => [i.path.join(".") || "query", i.message])
    );
    return res.status(400).json({ message: "Validation failed", errors });
  }

  const { search, category, author, available, sort, page, limit } = parsed.data;
  const filter = {};

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: regex }, { author: regex }];

    // ISBN DB mein hyphen ke bina hai, isliye search se hyphen/space hata do
    const isbnTerm = search.replace(/[-\s]/g, "");
    if (isbnTerm) {
      filter.$or.push({ isbn: new RegExp(escapeRegex(isbnTerm), "i") });
    }
  }
  if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  if (author) filter.author = new RegExp(escapeRegex(author), "i");
  if (available === true) filter.availableCopies = { $gt: 0 };
  if (available === false) filter.availableCopies = 0;

  const sortBy = sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

  const [books, total] = await Promise.all([
    Book.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit),
    Book.countDocuments(filter),
  ]);

  res.json({
    data: books,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
};

// POST /api/books (librarian)
export const createBook = async (req, res) => {
  const { isbn, totalCopies } = req.body;

  const exists = await Book.findOne({ isbn });
  if (exists) {
    return res.status(409).json({ message: "Book with this ISBN already exists" });
  }

  const book = await Book.create({ ...req.body, availableCopies: totalCopies });
  res.status(201).json(book);
};

// PUT /api/books/:id (librarian)
export const updateBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ message: "Book not found" });

  const { totalCopies, isbn, ...rest } = req.body;

  if (isbn !== undefined && isbn !== book.isbn) {
    const dup = await Book.findOne({ isbn });
    if (dup) return res.status(409).json({ message: "Book with this ISBN already exists" });
    book.isbn = isbn;
  }

  if (totalCopies !== undefined) {
    const issuedCount = book.totalCopies - book.availableCopies;
    if (totalCopies < issuedCount) {
      return res.status(400).json({
        message: `${issuedCount} copies are currently issued, total copies cannot be less than that`,
      });
    }
    book.totalCopies = totalCopies;
    book.availableCopies = totalCopies - issuedCount;
  }

  Object.assign(book, rest);
  const updated = await book.save();
  res.json(updated);
};

// DELETE /api/books/:id (librarian)
export const deleteBook = async (req, res) => {
  const activeIssues = await Issue.countDocuments({ book: req.params.id, status: "issued" });
  if (activeIssues > 0) {
    return res.status(400).json({
      message: `Cannot delete: ${activeIssues} copy(ies) currently issued`,
    });
  }

  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json({ message: "Book not found" });
  res.json({ message: "Book deleted successfully" });
};
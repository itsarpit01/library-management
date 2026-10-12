import Book from "../models/Book.js";
import Issue from "../models/Issue.js";

// GET /api/books
export const getBooks = async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/books/:id
export const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/books (librarian)
export const createBook = async (req, res) => {
  try {
    const { isbn, totalCopies } = req.body;

    const exists = await Book.findOne({ isbn });
    if (exists) {
      return res.status(400).json({ message: "Book with this ISBN already exists" });
    }

    const book = await Book.create({ ...req.body, availableCopies: totalCopies });
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/books/:id (librarian)
export const updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const { totalCopies, isbn, ...rest } = req.body;

    if (isbn !== undefined && isbn !== book.isbn) {
      const dup = await Book.findOne({ isbn });
      if (dup) return res.status(400).json({ message: "Book with this ISBN already exists" });
      book.isbn = isbn;
    }

    Object.assign(book, rest);

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

    const updated = await book.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/books/:id (librarian)
export const deleteBook = async (req, res) => {
  try {
    const activeIssues = await Issue.countDocuments({ book: req.params.id, status: "issued" });
    if (activeIssues > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${activeIssues} copy(ies) currently issued`,
      });
    }

    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
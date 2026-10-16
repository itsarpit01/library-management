import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import RequestFormModal from "../components/RequestFormModal";
import BorrowRequestModal from "../components/BorrowRequestModal";
import { SearchIcon, RequestIcon } from "../components/Icons";

const LIMIT = 8;

export default function PurchaserBooks() {
  const toast = useToast();

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);

  // null = band, {} = dropdown wala form, { bookId } = us book ka fixed form
  const [requestFor, setRequestFor] = useState(null);
  // null = band, book object = borrow request form
  const [borrowBook, setBorrowBook] = useState(null);

  const debouncedSearch = useDebounce(search);
  const debouncedCategory = useDebounce(category);

  // Sirf sabse latest request ka response use hoga
  const requestId = useRef(0);

  const loadBooks = useCallback(async () => {
    const myId = ++requestId.current;
    setLoading(true);
    try {
      const params = { sort, page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedCategory) params.category = debouncedCategory;
      if (available) params.available = available;

      const res = await api.get("/books", { params });
      if (myId !== requestId.current) return;
      setBooks(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      if (myId !== requestId.current) return;
      toast.error(getErrorMessage(err));
    } finally {
      if (myId === requestId.current) {
        setLoading(false);
        setFirstLoad(false);
      }
    }
  }, [debouncedSearch, debouncedCategory, available, sort, page, toast]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Browse Books</h2>
          <p>{pagination.total} book(s) in the library.</p>
        </div>
        <button className="btn" onClick={() => setRequestFor({})}>
          <RequestIcon size={18} /> Request a book
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <SearchIcon size={18} />
          <input
            placeholder="Search title, author or ISBN"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <input
          className="toolbar-input"
          placeholder="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="toolbar-input"
          value={available}
          onChange={(e) => {
            setAvailable(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All books</option>
          <option value="true">Available</option>
          <option value="false">Not available</option>
        </select>
        <select
          className="toolbar-input"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
          <option value="author">Author A-Z</option>
          <option value="price">Price low to high</option>
          <option value="-price">Price high to low</option>
          <option value="-createdAt">Newest first</option>
        </select>
      </div>

      {firstLoad && loading ? (
        <p className="empty">Loading books...</p>
      ) : books.length === 0 ? (
        <p className="empty">No books found. Try a different search.</p>
      ) : (
        <div
          className="book-grid"
          style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}
        >
          {books.map((b) => (
            <BookCard
              key={b._id}
              book={b}
              actions={
                <>
                  <button
                    className="btn btn-sm"
                    disabled={b.availableCopies < 1}
                    onClick={() => setBorrowBook(b)}
                  >
                    {b.availableCopies < 1 ? "Not available" : "Borrow"}
                  </button>
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => setRequestFor({ bookId: b._id })}
                  >
                    <RequestIcon size={16} /> Request this book
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-soft btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn btn-soft btn-sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {requestFor && (
        <RequestFormModal
          key={requestFor.bookId || "new"} // har book ke liye fresh state
          initial={requestFor}
          onClose={() => setRequestFor(null)}
          onSaved={() => {
            setRequestFor(null);
            toast.info("Track it under My Requests");
          }}
        />
      )}

      {borrowBook && (
        <BorrowRequestModal
          key={borrowBook._id}
          book={borrowBook}
          onClose={() => setBorrowBook(null)}
          onSaved={() => {
            setBorrowBook(null);
            toast.info("Track it under Borrow Requests");
          }}
        />
      )}
    </>
  );
}
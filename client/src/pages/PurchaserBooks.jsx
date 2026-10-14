import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import RequestFormModal from "../components/RequestFormModal";
import { SearchIcon, RequestIcon } from "../components/Icons";

const LIMIT = 8;

export default function PurchaserBooks() {
  const toast = useToast();

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);

  const [requestFor, setRequestFor] = useState(null); // { bookId } ya {} ya null

  const debouncedSearch = useDebounce(search);
  const debouncedCategory = useDebounce(category);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedCategory, available, sort]);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sort, page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedCategory) params.category = debouncedCategory;
      if (available) params.available = available;

      const res = await api.get("/books", { params });
      setBooks(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input
          className="toolbar-input"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <select className="toolbar-input" value={available} onChange={(e) => setAvailable(e.target.value)}>
          <option value="">All books</option>
          <option value="true">Available</option>
          <option value="false">Not available</option>
        </select>
        <select className="toolbar-input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
          <option value="author">Author A-Z</option>
          <option value="price">Price low to high</option>
          <option value="-price">Price high to low</option>
          <option value="-createdAt">Newest first</option>
        </select>
      </div>

      {loading ? (
        <p className="empty">Loading books...</p>
      ) : books.length === 0 ? (
        <p className="empty">No books found. Try a different search.</p>
      ) : (
        <div className="book-grid">
          {books.map((b) => (
            <BookCard
              key={b._id}
              book={b}
              actions={
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => setRequestFor({ bookId: b._id })}
                >
                  <RequestIcon size={16} /> Request this book
                </button>
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
          initial={requestFor}
          onClose={() => setRequestFor(null)}
          onSaved={() => {
            setRequestFor(null);
            toast.info("Track it under My Requests");
          }}
        />
      )}
    </>
  );
}
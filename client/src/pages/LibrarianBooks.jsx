import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import BookFormModal from "../components/BookFormModal";
import Modal from "../components/Modal";
import { PlusIcon, SearchIcon, EditIcon, TrashIcon } from "../components/Icons";

const LIMIT = 8;

export default function LibrarianBooks() {
  const toast = useToast();

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);

  const [formBook, setFormBook] = useState(undefined); // undefined=band, null=add, object=edit
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      if (myId !== requestId.current) return; // purana response, ignore
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

  const handleSaved = () => {
    setFormBook(undefined);
    loadBooks();
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/books/${toDelete._id}`);
      toast.success("Book deleted");
      setToDelete(null);
      // Last page ki akhri book delete ho to ek page peeche jao
      if (books.length === 1 && page > 1) setPage(page - 1);
      else loadBooks();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Books</h2>
          <p>{pagination.total} book(s) in your library.</p>
        </div>
        <button className="btn" onClick={() => setFormBook(null)}>
          <PlusIcon size={18} /> Add book
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
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="title">Title A-Z</option>
          <option value="-title">Title Z-A</option>
          <option value="author">Author A-Z</option>
          <option value="price">Price low to high</option>
          <option value="-price">Price high to low</option>
        </select>
      </div>

      {firstLoad && loading ? (
        <p className="empty">Loading books...</p>
      ) : books.length === 0 ? (
        <p className="empty">No books found.</p>
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
                  <button className="btn btn-soft btn-sm" onClick={() => setFormBook(b)}>
                    <EditIcon size={16} /> Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setToDelete(b)}>
                    <TrashIcon size={16} /> Delete
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-soft btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
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

      {formBook !== undefined && (
        <BookFormModal
          book={formBook}
          onClose={() => setFormBook(undefined)}
          onSaved={handleSaved}
        />
      )}

      {toDelete && (
        <Modal title="Delete book" onClose={() => setToDelete(null)}>
          <p>
            Delete <strong>{toDelete.title}</strong>? This cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToDelete(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
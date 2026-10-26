import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { getEffectiveTier } from "../utils/membershipConfig";
import useDebounce from "../hooks/useDebounce";
import BookCard from "../components/BookCard";
import RequestFormModal from "../components/RequestFormModal";
import MembershipModal from "../components/MembershipModal";
import { SearchIcon, RequestIcon } from "../components/Icons";

const LIMIT = 8;

export default function PurchaserBooks() {
  const { user } = useAuth();
  const toast = useToast();
  const tier = getEffectiveTier(user);

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("title");
  const [page, setPage] = useState(1);

  // Active slots tracking (Pending/Counter requests + Issued books)
  const [activeSlotsCount, setActiveSlotsCount] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // null = closed, {} = dropdown wala form, { bookId } = specific book modal
  const [requestFor, setRequestFor] = useState(null);

  const debouncedSearch = useDebounce(search);
  const requestId = useRef(0);

  // User ka current active quota load karna
  const loadUserQuota = useCallback(async () => {
    try {
      const [reqRes, issueRes] = await Promise.all([
        api.get("/purchase-requests/my").catch(() => ({ data: [] })),
        api.get("/issues/my").catch(() => ({ data: [] })),
      ]);

      const reqs = Array.isArray(reqRes.data) ? reqRes.data : [];
      const pendingReqs = reqs.filter((r) =>
        ["pending", "counter_offered"].includes(r.status)
      ).length;

      const issues = Array.isArray(issueRes.data) ? issueRes.data : [];
      const activeIssues = issues.filter((i) => i.status === "issued").length;

      setActiveSlotsCount(pendingReqs + activeIssues);
    } catch {
      // Background check failure silent
    }
  }, []);

  const loadBooks = useCallback(async () => {
    const myId = ++requestId.current;
    setLoading(true);
    try {
      const params = { sort, page, limit: LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
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
  }, [debouncedSearch, available, sort, page, toast]);

  useEffect(() => {
    loadBooks();
    loadUserQuota();
  }, [loadBooks, loadUserQuota]);

  // Quota status check
  const isQuotaFull = tier.maxBooks !== Infinity && activeSlotsCount >= tier.maxBooks;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Browse Books</h2>
          <p>{pagination.total} book(s) in the library.</p>
        </div>
        {isQuotaFull ? (
          <button
            className="btn"
            style={{
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => setShowUpgradeModal(true)}
            title="Quota reached. Click to upgrade your plan."
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Upgrade Plan ({activeSlotsCount}/{tier.maxBooks} used)
          </button>
        ) : (
          <button className="btn" onClick={() => setRequestFor({})}>
            <RequestIcon size={18} /> Request a book
          </button>
        )}
      </div>

      {/* Quota reached notification banner */}
      {isQuotaFull && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: 16,
            borderRadius: 8,
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid #c7d2fe",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#6366f1",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "0.88rem", color: "#3730a3", fontWeight: 500 }}>
              You have used all <strong>{activeSlotsCount}/{tier.maxBooks} slots</strong> on your <strong>{tier.name} Plan</strong>. Upgrade your membership to borrow or request more books.
            </span>
          </div>
          <button
            className="btn btn-sm"
            style={{
              background: "#4f46e5",
              color: "#fff",
              padding: "4px 12px",
              fontSize: "0.8rem",
            }}
            onClick={() => setShowUpgradeModal(true)}
          >
            Upgrade Now
          </button>
        </div>
      )}

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
          {books.map((b) => {
            const isAvailable = b.availableCopies > 0;
            return (
              <BookCard
                key={b._id}
                book={b}
                actions={
                  isQuotaFull ? (
                    <button
                      className="btn btn-sm"
                      style={{
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "#fff",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        width: "100%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        border: "none",
                      }}
                      onClick={() => setShowUpgradeModal(true)}
                      title="Your borrowing limit is reached. Upgrade your plan to request more books."
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      Upgrade plan to request more
                    </button>
                  ) : (
                    <button
                      className="btn btn-soft btn-sm"
                      onClick={() => setRequestFor({ bookId: b._id })}
                      disabled={!isAvailable}
                      title={!isAvailable ? "This book is currently out of stock" : "Request this book"}
                      style={{ width: "100%" }}
                    >
                      <RequestIcon size={16} /> {isAvailable ? "Request this book" : "Out of stock"}
                    </button>
                  )
                }
              />
            );
          })}
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

      {/* Book Request Modal */}
      {requestFor && (
        <RequestFormModal
          key={requestFor.bookId || "new"}
          initial={requestFor}
          onClose={() => setRequestFor(null)}
          onSaved={() => {
            setRequestFor(null);
            loadUserQuota(); // Request save hote hi quota refresh
            toast.info("Track it under My Requests");
          }}
        />
      )}

      {/* Upgrade Membership Modal */}
      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}
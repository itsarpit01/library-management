import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import ReissueModal from "../components/ReissueModal";
import { SearchIcon } from "../components/Icons";

export default function PurchaserIssues() {
  const toast = useToast();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateQuery, setDateQuery] = useState("");

  const [toReissue, setToReissue] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/issues/my");
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      // Status filter
      if (statusFilter === "issued" && i.status !== "issued") return false;
      if (statusFilter === "overdue" && (!i.isOverdue || i.status !== "issued")) return false;
      if (statusFilter === "returned" && i.status !== "returned") return false;

      // Search Query (Title, Author, ISBN)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = i.book?.title?.toLowerCase().includes(q);
        const matchAuthor = i.book?.author?.toLowerCase().includes(q);
        const matchIsbn = i.book?.isbn?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchIsbn) return false;
      }

      // Date Query (Checks dueDate, issueDate, or returnDate)
      if (dateQuery) {
        const dueStr = i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : "";
        const issueStr = i.issueDate ? new Date(i.issueDate).toISOString().slice(0, 10) : "";
        const returnStr = i.returnDate ? new Date(i.returnDate).toISOString().slice(0, 10) : "";
        if (dueStr !== dateQuery && issueStr !== dateQuery && returnStr !== dateQuery) {
          return false;
        }
      }

      return true;
    });
  }, [issues, statusFilter, searchQuery, dateQuery]);

  const statusBadge = (i) => {
    if (i.status === "returned") return <span className="badge badge-success" style={{ whiteSpace: "nowrap" }}>Returned</span>;
    if (i.isOverdue) return <span className="badge badge-danger" style={{ whiteSpace: "nowrap" }}>Overdue</span>;
    if (i.reissueRequested) {
      return (
        <span className="badge" style={{ backgroundColor: "#fff3e0", color: "#e65100", border: "1px solid #ffb74d", whiteSpace: "nowrap" }}>
          Reissue Requested
        </span>
      );
    }
    return <span className="badge badge-warning" style={{ whiteSpace: "nowrap" }}>Issued</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Issues</h2>
          <p>Books issued to you, return dates, and reissue requests.</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search by Book Title, Author */}
        <div className="search-box" style={{ flex: "1 1 220px" }}>
          <SearchIcon size={18} />
          <input
            placeholder="Search issued books by title, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Dropdown */}
        <select
          className="toolbar-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 140 }}
        >
          <option value="">All Statuses</option>
          <option value="issued">Issued</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
        </select>

        {/* Date Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            className="toolbar-input"
            value={dateQuery}
            onChange={(e) => setDateQuery(e.target.value)}
            title="Filter by due, issue, or return date"
            style={{ minWidth: 140 }}
          />
          {dateQuery && (
            <button
              className="btn btn-soft btn-sm"
              onClick={() => setDateQuery("")}
              style={{ padding: "4px 8px" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading issues...</p>
      ) : filteredIssues.length === 0 ? (
        <p className="empty">No issue records matching your filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th style={{ whiteSpace: "nowrap" }}>Issued Date</th>
                <th style={{ whiteSpace: "nowrap" }}>Due Date</th>
                <th style={{ whiteSpace: "nowrap" }}>Returned Date</th>
                <th>Status</th>
                <th>Fine</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((i) => (
                <tr key={i._id}>
                  <td>
                    <strong>{i.book?.title}</strong>
                    <span className="cell-sub" style={{ display: "inline-block", marginLeft: 6 }}>
                      by {i.book?.author}
                    </span>
                  </td>
                  {/* Single Line Dates */}
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(i.issueDate)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatDate(i.dueDate)}
                    {i.reissueCount > 0 && (
                      <span className="badge" style={{ fontSize: "0.72rem", marginLeft: 6 }}>
                        {i.reissueCount}x
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(i.returnDate)}</td>
                  <td>{statusBadge(i)}</td>
                  <td>{i.currentFine > 0 ? `₹${i.currentFine}` : "-"}</td>
                  <td>
                    {i.status === "issued" && (
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => setToReissue(i)}
                        disabled={i.reissueRequested || (i.reissueCount || 0) >= 2 || i.isOverdue}
                        style={{ whiteSpace: "nowrap" }}
                        title={
                          i.isOverdue
                            ? "Overdue books cannot be reissued. Please return."
                            : (i.reissueCount || 0) >= 2
                            ? "Max reissues reached"
                            : i.reissueRequested
                            ? "Reissue request already pending"
                            : "Request a reissue"
                        }
                      >
                        {i.reissueRequested ? "Requested" : "Reissue"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toReissue && (
        <ReissueModal
          issue={toReissue}
          mode="request"
          onClose={() => setToReissue(null)}
          onSaved={() => {
            setToReissue(null);
            load();
          }}
        />
      )}
    </>
  );
}
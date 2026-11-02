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
  const [toReissue, setToReissue] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Search, Status, and Date Range Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/issues/my");
      setIssues(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Tab switch par auto-refresh
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Cancel Reissue Request Handler
  const handleCancelReissue = async (id) => {
    if (!window.confirm("Are you sure you want to cancel your reissue request?")) return;
    setCancellingId(id);
    try {
      await api.patch(`/issues/${id}/cancel-reissue`);
      toast.success("Reissue request cancelled successfully");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to cancel reissue request"));
    } finally {
      setCancellingId(null);
    }
  };

  const filteredIssues = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return issues.filter((i) => {
      if (statusFilter) {
        if (statusFilter === "overdue" && !i.isOverdue) return false;
        if (statusFilter === "issued" && (i.status !== "issued" || i.isOverdue)) return false;
        if (statusFilter === "returned" && i.status !== "returned") return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = i.book?.title?.toLowerCase().includes(q);
        const matchAuthor = i.book?.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }

      if (startDate || endDate) {
        const d = i.issueDate ? new Date(i.issueDate).toISOString().slice(0, 10) : "";
        const from = startDate || "1970-01-01";
        const to = endDate || todayStr;
        if (d < from || d > to) return false;
      }

      return true;
    });
  }, [issues, statusFilter, searchQuery, startDate, endDate]);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const statusBadge = (i) => {
    if (i.status === "returned") {
      return <span className="badge badge-success" style={{ whiteSpace: "nowrap" }}>Returned</span>;
    }
    if (i.isOverdue) {
      return <span className="badge badge-danger" style={{ whiteSpace: "nowrap" }}>Overdue</span>;
    }
    if (i.reissueRequested) {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: "#fff7ed",
            color: "#c2410c",
            border: "1px solid #fdba74",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          Reissue Pending
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

      {/* Search & Date Range Toolbar */}
      <div
        className="toolbar"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 16,
        }}
      >
        <div className="search-box" style={{ maxWidth: 240, minWidth: 180, flex: "0 1 240px" }}>
          <SearchIcon size={16} />
          <input
            placeholder="Search title, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="toolbar-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            width: "auto",
            minWidth: 140,
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b6784' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
            paddingRight: 32,
            cursor: "pointer",
          }}
        >
          <option value="">All Statuses</option>
          <option value="issued">Issued</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
        </select>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            background: "var(--card-bg, #f9fafb)",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>From:</span>
          <input
            type="date"
            className="toolbar-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Issue start date"
          />
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>To:</span>
          <input
            type="date"
            className="toolbar-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Today"
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Issue end date"
          />
          {(startDate || endDate) && (
            <button
              className="btn btn-soft btn-sm"
              onClick={clearDateRange}
              style={{ padding: "3px 8px", fontSize: "0.75rem", marginLeft: 2 }}
              title="Reset date range"
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
                <th style={{ textAlign: "right" }}>Actions</th>
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
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(i.issueDate)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div>
                      {formatDate(i.dueDate)}
                      {i.reissueCount > 0 && (
                        <span className="badge" style={{ fontSize: "0.72rem", marginLeft: 6 }}>
                          {i.reissueCount}x
                        </span>
                      )}
                    </div>
                    {i.reissueRequested && i.reissueRequestedDate && (
                      <div style={{ fontSize: "0.75rem", color: "#c2410c", fontWeight: 600, marginTop: 2 }}>
                        Req: {formatDate(i.reissueRequestedDate)}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(i.returnDate)}</td>
                  <td>{statusBadge(i)}</td>
                  <td>{i.currentFine > 0 ? `₹${i.currentFine}` : "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    {i.status === "issued" && (
                      i.reissueRequested ? (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleCancelReissue(i._id)}
                          disabled={cancellingId === i._id}
                          style={{
                            whiteSpace: "nowrap",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "1px solid #fca5a5",
                            fontWeight: 600,
                          }}
                          title="Cancel your pending reissue request"
                        >
                          {cancellingId === i._id ? "Cancelling..." : "Cancel Request"}
                        </button>
                      ) : (
                        <button
                          className="btn btn-soft btn-sm"
                          onClick={() => setToReissue(i)}
                          disabled={(i.reissueCount || 0) >= 2 || i.isOverdue}
                          style={{ whiteSpace: "nowrap" }}
                          title={
                            i.isOverdue
                              ? "Overdue books cannot be reissued. Please return."
                              : (i.reissueCount || 0) >= 2
                              ? "Max reissues reached"
                              : "Request a reissue"
                          }
                        >
                          Reissue
                        </button>
                      )
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
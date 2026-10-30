import { useCallback, useEffect, useState, useMemo } from "react";

import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import IssueFormModal from "../components/IssueFormModal";
import ReissueModal from "../components/ReissueModal";
import Modal from "../components/Modal";
import { PlusIcon, ReturnIcon, SearchIcon } from "../components/Icons";


const TABS = [
  { key: "", label: "All" },
  { key: "issued", label: "Issued" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
];

export default function LibrarianIssues() {
  const toast = useToast();

  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [toReturn, setToReturn] = useState(null);
  const [toReissue, setToReissue] = useState(null);
  const [returning, setReturning] = useState(false);

  // ── Search & Date Range (client-side) ─────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredIssues = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return issues.filter((i) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle  = i.book?.title?.toLowerCase().includes(q);
        const matchAuthor = i.book?.author?.toLowerCase().includes(q);
        const matchIsbn   = i.book?.isbn?.toLowerCase().includes(q);
        const matchMember = i.member?.name?.toLowerCase().includes(q);
        const matchEmail  = i.member?.email?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchIsbn && !matchMember && !matchEmail) return false;
      }
      if (startDate || endDate) {
        const d    = i.issueDate ? new Date(i.issueDate).toISOString().slice(0, 10) : "";
        const from = startDate || "1970-01-01";
        const to   = endDate   || todayStr;
        if (d < from || d > to) return false;
      }
      return true;
    });
  }, [issues, searchQuery, startDate, endDate]);

  const clearDateRange = () => { setStartDate(""); setEndDate(""); };
  // ──────────────────────────────────────────────────────────────────────────

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab ? { status: tab } : {};
      const res = await api.get("/issues", { params });
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  // Auto-refresh when librarian switches back to this tab
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "visible") loadIssues(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", loadIssues);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", loadIssues);
    };
  }, [loadIssues]);


  const handleIssued = () => {
    setShowForm(false);
    loadIssues();
  };

  const handleReissued = () => {
    setToReissue(null);
    loadIssues();
  };

  const confirmReturn = async () => {
    setReturning(true);
    try {
      const res = await api.patch(`/issues/${toReturn._id}/return`);
      const fine = res.data.fine ?? res.data.currentFine ?? 0;
      toast.success(fine > 0 ? `Book returned. Fine: ₹${fine}` : "Book returned");
      setToReturn(null);
      loadIssues();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToReturn(null);
    } finally {
      setReturning(false);
    }
  };

  // Helper to render member tier badge (Clean SVGs, No Emojis)
  const renderTierBadge = (membership) => {
    const tier = membership?.tier || "free";
    if (tier === "ultimate") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "2px 7px",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Ultimate
        </span>
      );
    }
    if (tier === "premium") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #6366f1, #4338ca)",
            color: "#fff",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "2px 7px",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Premium
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          background: "var(--card-bg, #f3f4f6)",
          color: "var(--text-secondary, #6b7280)",
          fontSize: "0.72rem",
          border: "1px solid var(--border, #d1d5db)",
          padding: "2px 7px",
        }}
      >
        Free
      </span>
    );
  };

  const statusBadge = (i) => {
    if (i.status === "returned") return <span className="badge badge-success">Returned</span>;
    if (i.isOverdue) return <span className="badge badge-danger">Overdue</span>;
    if (i.reissueRequested) {
      return (
        <span className="badge" style={{ backgroundColor: "#fff3e0", color: "#e65100", border: "1px solid #ffb74d" }}>
          Reissue Requested
        </span>
      );
    }
    if (i.reissueCount > 0) {
      return (
        <span
          className="badge"
          style={{ backgroundColor: "var(--primary-subtle, #ede7f6)", color: "var(--primary, #5c6bc0)", border: "1px solid var(--primary, #5c6bc0)" }}
        >
          Reissued
        </span>
      );
    }
    return <span className="badge badge-warning">Issued</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Issue / Return</h2>
          <p>Issue books to members and take them back.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          <PlusIcon size={18} /> Issue book
        </button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
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
        <div className="search-box" style={{ maxWidth: 260, minWidth: 180, flex: "0 1 260px" }}>
          <SearchIcon size={16} />
          <input
            placeholder="Search book, member, ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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
            title="Issue date from"
          />
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>To:</span>
          <input
            type="date"
            className="toolbar-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Issue date to (leave blank for today)"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={clearDateRange}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary, #888)", padding: "0 2px", fontSize: 16, lineHeight: 1 }}
              title="Clear date range"
            >✕</button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading...</p>
      ) : filteredIssues.length === 0 ? (
        <p className="empty">No records found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Member</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Status</th>
                <th>Fine</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((i) => (
                <tr key={i._id}>
                  <td>
                    {i.book?.title}
                    <span className="cell-sub">{i.book?.author}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{i.member?.name}</span>
                      {renderTierBadge(i.member?.membership)}
                    </div>
                    <span className="cell-sub">{i.member?.email}</span>
                  </td>
                  <td>{formatDate(i.issueDate)}</td>
                  <td>
                    {formatDate(i.dueDate)}
                    {i.reissueCount > 0 && (
                      <span className="cell-sub">Reissued {i.reissueCount}x</span>
                    )}
                  </td>
                  <td>{formatDate(i.returnDate)}</td>
                  <td>{statusBadge(i)}</td>
                  <td>{i.currentFine > 0 ? `₹${i.currentFine}` : "-"}</td>
                  <td>
                    {i.status === "issued" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={i.reissueRequested ? "btn btn-sm" : "btn btn-soft btn-sm"}
                          onClick={() => setToReissue(i)}
                          title={i.reissueRequested ? `Member requested extension till ${formatDate(i.reissueRequestedDate)}` : "Reissue book"}
                        >
                          {i.reissueRequested ? "Review Reissue" : "Reissue"}
                        </button>
                        <button className="btn btn-soft btn-sm" onClick={() => setToReturn(i)}>
                          <ReturnIcon size={16} /> Return
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <IssueFormModal onClose={() => setShowForm(false)} onSaved={handleIssued} />}

      {toReissue && (
        <ReissueModal
          issue={toReissue}
          mode="direct"
          onClose={() => setToReissue(null)}
          onSaved={handleReissued}
        />
      )}

      {toReturn && (
        <Modal title="Return book" onClose={() => setToReturn(null)}>
          <p>
            Mark <strong>{toReturn.book?.title}</strong> as returned by{" "}
            <strong>{toReturn.member?.name}</strong> {renderTierBadge(toReturn.member?.membership)}?
          </p>
          {toReturn.currentFine > 0 && (
            <p style={{ marginTop: 10 }}>
              <span className="badge badge-danger">Late fine: ₹{toReturn.currentFine}</span>
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToReturn(null)}>
              Cancel
            </button>
            <button className="btn" onClick={confirmReturn} disabled={returning}>
              {returning ? "Returning..." : "Confirm return"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
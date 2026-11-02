import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate, dateInput, toDateInput } from "../utils/format";
import { reviewSchema } from "../schemas/requestSchema";
import { getEffectiveTier } from "../utils/membershipConfig";
import { statusBadge } from "./PurchaserRequests";
import Modal from "../components/Modal";
import IssueFormModal from "../components/IssueFormModal";
import { CheckIcon, XIcon, SearchIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "counter_offered", label: "Counter Offered" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function LibrarianRequests() {
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  // Normal request review
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [noteError, setNoteError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reissue review
  const [selectedReissue, setSelectedReissue] = useState(null);
  const [reissueDueDate, setReissueDueDate] = useState("");
  const [reissueSaving, setReissueSaving] = useState(false);
  const [reissueError, setReissueError] = useState("");

  const [issueModalData, setIssueModalData] = useState(null);

  // Search & Date Range
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both book requests & pending reissues in parallel
      const [reqRes, reissueRes] = await Promise.all([
        api.get("/purchase-requests", { params: tab && tab !== "pending" ? { status: tab } : {} }),
        api.get("/issues", { params: { reissueRequested: true } }),
      ]);

      const rawRequests = Array.isArray(reqRes.data) ? reqRes.data : [];
      const rawReissues = Array.isArray(reissueRes.data) ? reissueRes.data : [];

      // Reissues ko standard request format me map karke same table me lana
      const mappedReissues = rawReissues.map((i) => ({
        _id: i._id,
        isReissue: true,
        issueRaw: i,
        title: i.book?.title,
        author: i.book?.author,
        isbn: i.book?.isbn,
        requestedBy: i.member,
        quantity: 1,
        neededUntil: i.reissueRequestedDate,
        currentDueDate: i.dueDate,
        reissueCount: i.reissueCount || 0,
        createdAt: i.reissueRequestedDate || i.updatedAt || i.createdAt,
        status: "reissue_pending",
      }));

      // Filter by tab
      let combined = [];
      if (tab === "pending") {
        const pendingBookReqs = rawRequests.filter((r) => r.status === "pending");
        combined = [...mappedReissues, ...pendingBookReqs];
      } else if (tab === "") {
        combined = [...mappedReissues, ...rawRequests];
      } else {
        // counter_offered, approved, rejected
        combined = rawRequests.filter((r) => r.status === tab);
      }

      setRequests(combined);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tab switch par auto-refresh
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", loadData);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", loadData);
    };
  }, [loadData]);

  // Client-side search and date range
  const filteredRequests = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return requests.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        const matchMember = r.requestedBy?.name?.toLowerCase().includes(q);
        const matchEmail = r.requestedBy?.email?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor && !matchMember && !matchEmail) return false;
      }
      if (startDate || endDate) {
        const d = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        const from = startDate || "1970-01-01";
        const to = endDate || todayStr;
        if (d < from || d > to) return false;
      }
      return true;
    });
  }, [requests, searchQuery, startDate, endDate]);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  // Normal book request open
  const openReview = (r) => {
    setSelected(r);
    setNote(r.reviewNote || "");
    setProposedDate(
      r.proposedDate
        ? toDateInput(r.proposedDate)
        : r.neededUntil
        ? toDateInput(r.neededUntil)
        : dateInput(1)
    );
    setNoteError("");
    setFormError("");
  };

  // Reissue request open
  const openReissueReview = (r) => {
    setSelectedReissue(r);
    setReissueDueDate(r.neededUntil ? toDateInput(r.neededUntil) : dateInput(7));
    setReissueError("");
  };

  const handleApproveReissue = async () => {
    if (!reissueDueDate) {
      setReissueError("Please select a valid return due date");
      return;
    }
    setReissueSaving(true);
    setReissueError("");
    try {
      await api.patch(`/issues/${selectedReissue._id}/reissue`, { dueDate: reissueDueDate });
      toast.success("Reissue request approved! Book extended.");
      setSelectedReissue(null);
      loadData();
    } catch (err) {
      setReissueError(getErrorMessage(err, "Failed to approve reissue"));
    } finally {
      setReissueSaving(false);
    }
  };

  const handleRejectReissue = async () => {
    if (!window.confirm("Are you sure you want to reject this reissue request?")) return;
    setReissueSaving(true);
    setReissueError("");
    try {
      await api.patch(`/issues/${selectedReissue._id}/reject-reissue`);
      toast.success("Reissue request rejected");
      setSelectedReissue(null);
      loadData();
    } catch (err) {
      setReissueError(getErrorMessage(err, "Failed to reject reissue"));
    } finally {
      setReissueSaving(false);
    }
  };

  const memberTier = getEffectiveTier(selected?.requestedBy);
  const userNeededDate = selected?.neededUntil ? toDateInput(selected.neededUntil) : "";
  const isDateMismatch = Boolean(selected && proposedDate && userNeededDate && proposedDate !== userNeededDate);
  const isCounterOffered = selected?.status === "counter_offered";
  const canApprove = !saving && !isCounterOffered && !isDateMismatch;

  const review = async (status) => {
    setNoteError("");
    setFormError("");

    if (status === "approved" && isDateMismatch) {
      setFormError("Dates do not match. Please propose the alternate date to the member first.");
      return;
    }

    if (reviewSchema) {
      const parsed = reviewSchema.safeParse({ reviewNote: note });
      if (!parsed.success) {
        setNoteError(parsed.error.issues[0].message);
        return;
      }
    }

    const payload = { status };
    if (note) payload.reviewNote = note;
    if (status === "counter_offered") {
      if (!proposedDate) {
        setFormError("Please select a proposed return date for counter offer");
        return;
      }
      payload.proposedDate = proposedDate;
    }

    setSaving(true);
    try {
      await api.patch(`/purchase-requests/${selected._id}/review`, payload);
      toast.success(
        status === "approved"
          ? "Request approved! Opening issue form..."
          : status === "counter_offered"
          ? "Counter offer sent to member"
          : "Request rejected"
      );

      const approvedReq = selected;
      setSelected(null);
      loadData();

      if (status === "approved") {
        setIssueModalData({
          memberId: approvedReq.requestedBy?._id,
          member: approvedReq.requestedBy,
          bookId: approvedReq.book?._id || approvedReq.book,
          book: {
            _id: approvedReq.book?._id || approvedReq.book,
            title: approvedReq.title,
            author: approvedReq.author,
          },
          dueDate: approvedReq.neededUntil,
          requestId: approvedReq._id,
          isLockedFromRequest: true,
        });
      }
    } catch (err) {
      const fe = getFieldErrors(err);
      if (fe.reviewNote) setNoteError(fe.reviewNote);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Requests</h2>
          <p>Review book requests and reissue requests from members.</p>
        </div>
      </div>

      {/* Tabs */}
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
            placeholder="Search book, author, member..."
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
            title="Start date filter"
          />
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>To:</span>
          <input
            type="date"
            className="toolbar-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="End date filter"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={clearDateRange}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary, #888)",
                padding: "0 2px",
                fontSize: 16,
                lineHeight: 1,
              }}
              title="Clear date range"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading requests...</p>
      ) : filteredRequests.length === 0 ? (
        <p className="empty">No requests found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Requested by</th>
                <th>Qty</th>
                <th>Needed until</th>
                <th>Proposed return</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.isReissue ? `reissue-${r._id}` : r._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong>{r.title}</strong>
                      {r.isReissue && (
                        <span
                          className="badge"
                          style={{
                            background: "#fff7ed",
                            color: "#c2410c",
                            border: "1px solid #fdba74",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                          }}
                        >
                          Reissue
                        </span>
                      )}
                    </div>
                    <span className="cell-sub">{r.author}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{r.requestedBy?.name}</span>
                      {renderTierBadge(r.requestedBy?.membership)}
                    </div>
                    <span className="cell-sub">{r.requestedBy?.email}</span>
                  </td>
                  <td>{r.quantity}</td>
                  <td>
                    {formatDate(r.neededUntil)}
                    {r.isReissue && (
                      <div style={{ fontSize: "0.72rem", color: "#c2410c", fontWeight: 600 }}>
                        (Extended)
                      </div>
                    )}
                  </td>
                  <td>
                    {r.isReissue ? (
                      <span style={{ fontSize: "0.82rem", color: "var(--text-secondary, #6b7280)" }}>
                        Due: {formatDate(r.currentDueDate)}
                      </span>
                    ) : r.proposedDate ? (
                      formatDate(r.proposedDate)
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    {r.isReissue ? (
                      <span
                        className="badge"
                        style={{
                          background: "#fff7ed",
                          color: "#c2410c",
                          border: "1px solid #fdba74",
                          fontWeight: 600,
                        }}
                      >
                        Pending Reissue
                      </span>
                    ) : (
                      statusBadge(r.status)
                    )}
                  </td>
                  <td>
                    {r.isReissue ? (
                      <button
                        className="btn btn-sm"
                        onClick={() => openReissueReview(r)}
                        style={{
                          background: "#ea580c",
                          color: "#fff",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Review
                      </button>
                    ) : (
                      <button className="btn btn-soft btn-sm" onClick={() => openReview(r)}>
                        {r.status === "pending" || r.status === "counter_offered" ? "Review" : "View"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reissue Review Modal */}
      {selectedReissue && (
        <Modal title="Review Reissue Request" onClose={() => setSelectedReissue(null)}>
          {reissueError && <div className="alert-error">{reissueError}</div>}

          <div className="detail-list">
            <p><span>Type</span><strong style={{ color: "#c2410c" }}>Book Reissue Request</strong></p>
            <p><span>Book Title</span>{selectedReissue.title}</p>
            <p><span>Author</span>{selectedReissue.author}</p>
            <p>
              <span>Requested by</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {selectedReissue.requestedBy?.name}
                {renderTierBadge(selectedReissue.requestedBy?.membership)}
              </span>
            </p>
            <p><span>Current Due Date</span>{formatDate(selectedReissue.currentDueDate)}</p>
            <p>
              <span>Requested Extended Date</span>
              <strong style={{ color: "#ea580c" }}>{formatDate(selectedReissue.neededUntil)}</strong>
            </p>
            <p><span>Reissues Used</span>{selectedReissue.reissueCount}/2 used</p>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="reissueDueDate">Approve with New Due Date</label>
            <input
              id="reissueDueDate"
              type="date"
              min={dateInput(1)}
              value={reissueDueDate}
              onChange={(e) => setReissueDueDate(e.target.value)}
            />
            <span className="hint">
              Member requested until: <strong>{formatDate(selectedReissue.neededUntil)}</strong>. You can accept this or adjust the return date.
            </span>
          </div>

          <div className="modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleRejectReissue}
              disabled={reissueSaving}
              style={{ color: "#ef4444", borderColor: "#ef4444" }}
            >
              <XIcon size={16} /> Reject
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleApproveReissue}
              disabled={reissueSaving}
              style={{ background: "#ea580c", color: "#fff" }}
            >
              <CheckIcon size={16} /> {reissueSaving ? "Approving..." : "Approve Reissue"}
            </button>
          </div>
        </Modal>
      )}

      {/* Standard Book Request Review Modal */}
      {selected && (
        <Modal title="Purchase request" onClose={() => setSelected(null)}>
          {formError && <div className="alert-error">{formError}</div>}

          <div className="detail-list">
            <p><span>Title</span>{selected.title}</p>
            <p><span>Author</span>{selected.author}</p>
            {selected.isbn && <p><span>ISBN</span>{selected.isbn}</p>}
            <p><span>Quantity</span>{selected.quantity}</p>
            <p><span>Needed until</span>{formatDate(selected.neededUntil)}</p>
            {selected.proposedDate && (
              <p><span>Proposed return date</span>{formatDate(selected.proposedDate)}</p>
            )}
            <p>
              <span>Requested by</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {selected.requestedBy?.name}
                {renderTierBadge(selected.requestedBy?.membership)}
              </span>
            </p>
            <p><span>Reason</span>{selected.reason || "-"}</p>
            <p><span>Status</span>{statusBadge(selected.status)}</p>
            {selected.status !== "pending" && selected.status !== "counter_offered" && (
              <p><span>Note</span>{selected.reviewNote || "-"}</p>
            )}
          </div>

          {selected.status === "pending" || selected.status === "counter_offered" ? (
            <>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="proposedDate">Propose alternate return date (if giving for less time)</label>
                <input
                  id="proposedDate"
                  type="date"
                  min={dateInput(1)}
                  max={
                    memberTier.tier !== "ultimate" && memberTier.maxIssueDays !== Infinity
                      ? dateInput(memberTier.maxIssueDays)
                      : undefined
                  }
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                />
                <span className="hint">
                  Member requested: <strong>{selected.neededUntil ? formatDate(selected.neededUntil) : "-"}</strong>.
                  {" "}Plan limit: <strong>{memberTier.tier === "ultimate" ? "All upcoming dates available" : `Max ${memberTier.maxIssueDays} days`}</strong>.
                  {isDateMismatch && (
                    <span
                      style={{
                        color: "#d97706",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                        fontSize: "0.85rem",
                      }}
                    >
                      Date mismatch: Click <strong>"Propose Date"</strong> to negotiate with the user first.
                    </span>
                  )}
                </span>
              </div>

              <div className="field">
                <label htmlFor="note">Review note (optional)</label>
                <textarea
                  id="note"
                  rows={3}
                  placeholder="e.g. Approved with proposed date, or reason for rejection"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {noteError && <span className="error-text">{noteError}</span>}
              </div>

              <div className="modal-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => review("rejected")}
                  disabled={saving}
                  style={{ color: "#ef4444", borderColor: "#ef4444" }}
                >
                  <XIcon size={16} /> Reject
                </button>

                {isDateMismatch && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => review("counter_offered")}
                    disabled={saving}
                    style={{ background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" }}
                  >
                    Propose Date
                  </button>
                )}

                <button
                  type="button"
                  className="btn"
                  onClick={() => review("approved")}
                  disabled={!canApprove}
                  title={
                    isDateMismatch
                      ? "Cannot approve while proposed date differs from member date. Propose alternate date first."
                      : isCounterOffered
                      ? "Waiting for member to accept or reject counter offer."
                      : "Approve and open issue form"
                  }
                >
                  <CheckIcon size={16} /> {saving ? "Saving..." : "Approve"}
                </button>
              </div>
            </>
          ) : (
            <div className="modal-actions">
              <button className="btn btn-soft" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Book Issue Form Modal (After Book Request Approved) */}
      {issueModalData && (
        <IssueFormModal
          initialData={issueModalData}
          onClose={() => setIssueModalData(null)}
          onIssued={() => {
            setIssueModalData(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
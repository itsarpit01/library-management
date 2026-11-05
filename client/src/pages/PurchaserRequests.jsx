import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import RequestFormModal from "../components/RequestFormModal";
import Modal from "../components/Modal";
import { PlusIcon, TrashIcon, EditIcon, CheckIcon, SearchIcon } from "../components/Icons";

export const statusBadge = (status) => {
  const cls = {
    pending: "badge-warning",
    counter_offered: "badge-warning",
    approved: "badge-success",
    rejected: "badge-danger",
  }[status] || "badge-secondary";

  const label = status === "counter_offered" ? "Counter Offered" : status;
  return <span className={`badge ${cls}`} style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}>{label}</span>;
};

export default function PurchaserRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const tier = getEffectiveTier(user);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search Toolbar
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Date Range (From - To)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state (8 items per page)
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [viewRequest, setViewRequest] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  const [activeIssuesCount, setActiveIssuesCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, issueRes] = await Promise.all([
        api.get("/purchase-requests/my", { params: statusFilter ? { status: statusFilter } : {} }),
        api.get("/issues/my").catch(() => ({ data: [] })),
      ]);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
      const issues = Array.isArray(issueRes.data) ? issueRes.data : [];
      setActiveIssuesCount(issues.filter((i) => i.status === "issued").length);
      window.dispatchEvent(new Event("quota-updated"));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Reset page to 1 whenever search or filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, startDate, endDate]);

  // Quota calculation
  const pendingCount = requests.filter((r) => ["pending", "counter_offered"].includes(r.status)).length;
  const totalActiveSlots = activeIssuesCount + pendingCount;
  const isQuotaFull = tier.maxBooks !== Infinity && totalActiveSlots >= tier.maxBooks;

  // Filtered requests by Search query & Date Range
  const filteredRequests = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return requests.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }

      if (startDate || endDate) {
        const createdDate = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        const fromDate = startDate || "1970-01-01";
        const toDate = endDate || todayStr;

        if (createdDate < fromDate || createdDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [requests, searchQuery, startDate, endDate]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, page]);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await api.delete(`/purchase-requests/${toCancel._id}`);
      toast.success("Request cancelled");

      window.dispatchEvent(new Event("quota-updated"));

      setToCancel(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToCancel(null);
    } finally {
      setCancelling(false);
    }
  };

  const handleAcceptCounter = async (req) => {
    setAcceptingId(req._id);
    try {
      await api.patch(`/purchase-requests/${req._id}/accept-counter`);
      toast.success("Accepted counter offer. Waiting for librarian to issue book.");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Book Requests</h2>
          <p>Request new books or track your pending approvals.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isQuotaFull && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "#dc2626",
                fontWeight: 600,
                background: "rgba(239, 68, 68, 0.1)",
                padding: "6px 12px",
                borderRadius: 8,
              }}
            >
              Slots limit reached ({tier.maxBooks} max on {tier.name} plan)
            </span>
          )}

          <button
            className="btn"
            onClick={() => setShowForm(true)}
            disabled={isQuotaFull}
            title={isQuotaFull ? "You have reached your active slots limit. Return an issued book or wait for reviews." : "Request a book"}
          >
            <PlusIcon size={18} /> Request Book
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="toolbar"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[
            { key: "", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "counter_offered", label: "Counter Offered" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab ${statusFilter === t.key ? "active" : ""}`}
              onClick={() => setStatusFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary, #9ca3af)",
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="toolbar-input"
            placeholder="Search by book title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--card-bg, #fff)",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>
            From:
          </span>
          <input
            type="date"
            className="toolbar-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="Start date (Requests from this date onwards)"
          />

          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", fontWeight: 600 }}>
            To:
          </span>
          <input
            type="date"
            className="toolbar-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Today"
            style={{ width: 125, padding: "4px 6px", fontSize: "0.8rem" }}
            title="End date (leave blank for up to today)"
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
        <p className="empty">Loading requests...</p>
      ) : filteredRequests.length === 0 ? (
        <p className="empty">No requests matching your filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Book</th>
                <th style={{ whiteSpace: "nowrap" }}>Requested on</th>
                <th style={{ whiteSpace: "nowrap" }}>Qty</th>
                <th style={{ whiteSpace: "nowrap" }}>Needed until</th>
                <th style={{ whiteSpace: "nowrap" }}>Librarian proposed</th>
                <th style={{ whiteSpace: "nowrap" }}>Status</th>
                <th style={{ whiteSpace: "nowrap" }}>Librarian note</th>
                <th style={{ whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((r) => (
                <tr key={r._id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <strong>{r.title}</strong>
                    {r.author && (
                      <span style={{ fontSize: "12px", color: "var(--muted, #6b6784)", marginLeft: 6 }}>
                        by {r.author}
                      </span>
                    )}
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.quantity}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.neededUntil)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.proposedDate ? (
                      <strong style={{ color: "var(--primary, #5c6bc0)" }}>
                        {formatDate(r.proposedDate)}
                      </strong>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>{statusBadge(r.status)}</td>

                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.reviewNote ? (
                      <span>
                        {r.reviewNote}
                        {r.reviewedBy?.name && (
                          <span style={{ fontSize: "12px", color: "var(--muted, #6b6784)", marginLeft: 4 }}>
                            ({r.reviewedBy.name})
                          </span>
                        )}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.status === "counter_offered" ? (
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleAcceptCounter(r)}
                          disabled={acceptingId === r._id}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          <CheckIcon size={16} /> {acceptingId === r._id ? "Accepting..." : "Accept"}
                        </button>
                        <button className="btn btn-soft btn-sm" onClick={() => setToEdit(r)} style={{ whiteSpace: "nowrap" }}>
                          <EditIcon size={16} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToCancel(r)} style={{ whiteSpace: "nowrap" }}>
                          <TrashIcon size={16} /> Cancel
                        </button>
                      </div>
                    ) : r.status === "pending" ? (
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                        <button className="btn btn-soft btn-sm" onClick={() => setToEdit(r)} style={{ whiteSpace: "nowrap" }}>
                          <EditIcon size={16} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToCancel(r)} style={{ whiteSpace: "nowrap" }}>
                          <TrashIcon size={16} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => setViewRequest(r)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Direct First & Last Jump Pagination */}
          {totalPages > 1 && (
            <div
              className="pagination"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="Go to First Page"
              >
                « First
              </button>

              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Previous Page"
              >
                ‹ Prev
              </button>

              <span style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 8px" }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                title="Next Page"
              >
                Next ›
              </button>

              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                title="Go to Last Page"
              >
                Last »
              </button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <RequestFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {toEdit && (
        <RequestFormModal
          request={toEdit}
          onClose={() => setToEdit(null)}
          onSaved={() => {
            setToEdit(null);
            load();
          }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {toCancel && (
        <Modal title="Cancel request" onClose={() => setToCancel(null)}>
          <p>
            Cancel your request for <strong>{toCancel.title}</strong>? Your slot will be freed immediately.
          </p>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToCancel(null)}>
              Keep it
            </button>
            <button className="btn btn-danger" onClick={confirmCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel request"}
            </button>
          </div>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewRequest && (
        <Modal title="Request Details" onClose={() => setViewRequest(null)}>
          <div className="detail-list">
            <p><span>Book</span><strong>{viewRequest.title}</strong></p>
            <p><span>Author</span>{viewRequest.author}</p>
            {viewRequest.isbn && <p><span>ISBN</span>{viewRequest.isbn}</p>}
            <p><span>Quantity</span>{viewRequest.quantity}</p>
            <p><span>Requested Date</span><span style={{ whiteSpace: "nowrap" }}>{formatDate(viewRequest.createdAt)}</span></p>
            <p><span>Needed Until</span><span style={{ whiteSpace: "nowrap" }}>{formatDate(viewRequest.neededUntil)}</span></p>
            {viewRequest.proposedDate && (
              <p><span>Librarian Proposed</span><span style={{ whiteSpace: "nowrap" }}>{formatDate(viewRequest.proposedDate)}</span></p>
            )}
            <p><span>Status</span>{statusBadge(viewRequest.status)}</p>
            {viewRequest.reviewNote && (
              <p><span>Librarian Note</span>{viewRequest.reviewNote}</p>
            )}
            {viewRequest.reviewedBy && (
              <p><span>Reviewed By</span>{viewRequest.reviewedBy?.name}</p>
            )}
            {viewRequest.reason && (
              <p><span>Your Reason</span>{viewRequest.reason}</p>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setViewRequest(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
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
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Quota calculation
  const pendingCount = requests.filter((r) => ["pending", "counter_offered"].includes(r.status)).length;
  const totalActiveSlots = activeIssuesCount + pendingCount;
  const isQuotaFull = tier.maxBooks !== Infinity && totalActiveSlots >= tier.maxBooks;

  // Filtered requests by Search query & Date Range (From -> Today / To)
  const filteredRequests = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    return requests.filter((r) => {
      // 1. Search by Book name or author
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }

      // 2. Date Range Filter on Request Creation Date (createdAt)
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

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await api.delete(`/purchase-requests/${toCancel._id}`);
      toast.success("Request cancelled");

      // Real-time signal for sidebar quota
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

  const handleAcceptCounter = async (r) => {
    setAcceptingId(r._id);
    try {
      await api.patch(`/purchase-requests/${r._id}/accept-counter`);
      toast.success("Proposed date accepted! Your needed-until date is updated.");

      window.dispatchEvent(new Event("quota-updated"));
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
          <h2>My Requests</h2>
          <p>Request books from the library. You can review dates or edit until approved.</p>
        </div>
        <button
          className="btn"
          onClick={() => setShowForm(true)}
          disabled={isQuotaFull}
          title={isQuotaFull ? `Limit reached (${totalActiveSlots}/${tier.maxBooks} slots used). Return a book or upgrade plan.` : "Submit a new request"}
        >
          <PlusIcon size={18} /> {isQuotaFull ? "Limit Reached" : "New request"}
        </button>
      </div>

      {/* Search & Date Range Toolbar (1 Single Horizontal Line) */}
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
        {/* Compact Search Bar */}
        <div className="search-box" style={{ maxWidth: 240, minWidth: 180, flex: "0 1 240px" }}>
          <SearchIcon size={16} />
          <input
            placeholder="Search book or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Dropdown with Inner SVG Arrow */}
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
          <option value="pending">Pending</option>
          <option value="counter_offered">Counter Offered</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Date Range: From -> To (Locked in 1 Single Line) */}
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
              {filteredRequests.map((r) => (
                <tr key={r._id}>
                  {/* Book & Author in 1 Single Line */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <strong>{r.title}</strong>
                    {r.author && (
                      <span style={{ fontSize: "12px", color: "var(--muted, #6b6784)", marginLeft: 6 }}>
                        by {r.author}
                      </span>
                    )}
                  </td>

                  {/* Requested Date */}
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>

                  {/* Qty */}
                  <td style={{ whiteSpace: "nowrap" }}>{r.quantity}</td>

                  {/* Needed Until */}
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.neededUntil)}</td>

                  {/* Librarian Proposed Date */}
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.proposedDate ? (
                      <strong style={{ color: "var(--primary, #5c6bc0)" }}>
                        {formatDate(r.proposedDate)}
                      </strong>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ whiteSpace: "nowrap" }}>{statusBadge(r.status)}</td>

                  {/* Librarian Note in 1 Single Line */}
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

                  {/* Actions in 1 Single Line */}
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
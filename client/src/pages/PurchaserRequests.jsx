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
  const [customDate, setCustomDate] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [viewRequest, setViewRequest] = useState(null); // Modal for Approved/Rejected View
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

  // Filtered requests by Search query & Custom Date
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Search by Book name or author
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchAuthor = r.author?.toLowerCase().includes(q);
        if (!matchTitle && !matchAuthor) return false;
      }
      // Filter by Custom Date (checks neededUntil or createdAt)
      if (customDate) {
        const neededStr = r.neededUntil ? new Date(r.neededUntil).toISOString().slice(0, 10) : "";
        const createdStr = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        if (neededStr !== customDate && createdStr !== customDate) return false;
      }
      return true;
    });
  }, [requests, searchQuery, customDate]);

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await api.delete(`/purchase-requests/${toCancel._id}`);
      toast.success("Request cancelled");

      // ⚡ Real-Time Signal: Cancel hote hi sidebar slot instant free (+1)
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

      // ⚡ Real-Time Signal
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

      {/* Search & Filter Toolbar */}
      <div className="toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search input by Book Title or Author */}
        <div className="search-box" style={{ flex: "1 1 220px" }}>
          <SearchIcon size={18} />
          <input
            placeholder="Search by book name or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Dropdown */}
        <select
          className="toolbar-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 150 }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="counter_offered">Counter Offered</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Custom Date Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            className="toolbar-input"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            title="Filter by needed date or request date"
            style={{ minWidth: 140 }}
          />
          {customDate && (
            <button
              className="btn btn-soft btn-sm"
              onClick={() => setCustomDate("")}
              title="Clear date filter"
              style={{ padding: "4px 8px" }}
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
                <th>Book</th>
                {/* 📅 Requested on date column */}
                <th style={{ whiteSpace: "nowrap" }}>Requested on</th>
                <th>Qty</th>
                <th style={{ whiteSpace: "nowrap" }}>Needed until</th>
                <th style={{ whiteSpace: "nowrap" }}>Librarian proposed</th>
                <th>Status</th>
                <th>Librarian note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r._id}>
                  <td>
                    <strong>{r.title}</strong>
                    <span className="cell-sub" style={{ display: "inline-block", marginLeft: 6 }}>
                      by {r.author}
                    </span>
                  </td>
                  {/* Single Line Requested on Date */}
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>
                  <td>{r.quantity}</td>
                  {/* Single Line Needed until Date */}
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
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    {r.reviewNote ? (
                      <span style={{ whiteSpace: "nowrap" }}>
                        {r.reviewNote} {r.reviewedBy && <span className="cell-sub">({r.reviewedBy.name})</span>}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {r.status === "counter_offered" ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleAcceptCounter(r)}
                          disabled={acceptingId === r._id}
                        >
                          <CheckIcon size={16} /> {acceptingId === r._id ? "Accepting..." : "Accept"}
                        </button>
                        <button className="btn btn-soft btn-sm" onClick={() => setToEdit(r)}>
                          <EditIcon size={16} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToCancel(r)}>
                          <TrashIcon size={16} /> Cancel
                        </button>
                      </div>
                    ) : r.status === "pending" ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", whiteSpace: "nowrap" }}>
                        <button className="btn btn-soft btn-sm" onClick={() => setToEdit(r)}>
                          <EditIcon size={16} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToCancel(r)}>
                          <TrashIcon size={16} /> Cancel
                        </button>
                      </div>
                    ) : (
                      /* Approved ya Rejected par VIEW button */
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

      {/* View Details Modal for Approved / Rejected Requests */}
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
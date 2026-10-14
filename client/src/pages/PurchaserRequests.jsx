import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import RequestFormModal from "../components/RequestFormModal";
import Modal from "../components/Modal";
import { PlusIcon, TrashIcon, EditIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

// eslint-disable-next-line react-refresh/only-export-components
export const statusBadge = (status) => {
  const cls = { pending: "badge-warning", approved: "badge-success", rejected: "badge-danger" }[status];
  return <span className={`badge ${cls}`}>{status}</span>;
};

export default function PurchaserRequests() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/purchase-requests/my", { params: tab ? { status: tab } : {} });
      setRequests(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await api.delete(`/purchase-requests/${toCancel._id}`);
      toast.success("Request cancelled");
      setToCancel(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToCancel(null);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Requests</h2>
          <p>Ask the librarian to buy more copies. You can edit a request until it is reviewed.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          <PlusIcon size={18} /> New request
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

      {loading ? (
        <p className="empty">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="empty">No requests found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Librarian note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id}>
                  <td>
                    {r.title}
                    <span className="cell-sub">{r.author}</span>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.reason || "-"}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    {r.reviewNote || "-"}
                    {r.reviewedBy && <span className="cell-sub">by {r.reviewedBy.name}</span>}
                  </td>
                  <td>
                    {r.status === "pending" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-soft btn-sm" onClick={() => setToEdit(r)}>
                          <EditIcon size={16} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToCancel(r)}>
                          <TrashIcon size={16} /> Cancel
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

      {toCancel && (
        <Modal title="Cancel request" onClose={() => setToCancel(null)}>
          <p>
            Cancel your request for <strong>{toCancel.title}</strong>?
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
    </>
  );
}
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate } from "../utils/format";
import Modal from "../components/Modal";
import { CheckIcon, XIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const statusBadge = (s) => {
  const cls = s === "approved" ? "badge-success" : s === "rejected" ? "badge-danger" : "badge-warning";
  return <span className={`badge ${cls}`}>{s}</span>;
};

export default function BorrowRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const isLib = user.role === "librarian";

  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toCancel, setToCancel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(isLib ? "/borrow-requests" : "/borrow-requests/my", {
        params: tab ? { status: tab } : {},
      });
      setRequests(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, isLib, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openReview = (r) => {
    setSelected(r);
    setNote("");
    setNoteError("");
    setFormError("");
  };

  const review = async (status) => {
    const n = note.trim();
    setNoteError("");
    setFormError("");
    if (status === "rejected" && !n) return setNoteError("Add a note when rejecting");
    if (n.length > 300) return setNoteError("Max 300 characters");

    const payload = { status };
    if (n) payload.reviewNote = n;

    setSaving(true);
    try {
      await api.patch(`/borrow-requests/${selected._id}/review`, payload);
      toast.success(status === "approved" ? "Request approved" : "Request rejected");
      setSelected(null);
      load();
    } catch (err) {
      const fe = getFieldErrors(err);
      if (fe.reviewNote) setNoteError(fe.reviewNote);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    setSaving(true);
    try {
      await api.delete(`/borrow-requests/${toCancel._id}`);
      toast.success("Request cancelled");
      setToCancel(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToCancel(null);
    } finally {
      setSaving(false);
    }
  };

  const typeBadge = (t) => (
    <span className="badge">{t === "reissue" ? "Reissue" : "Borrow"}</span>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Borrow Requests</h2>
          <p>
            {isLib
              ? "Approve or reject borrow and reissue requests."
              : "Your borrow and reissue requests. Request a book from Browse Books."}
          </p>
        </div>
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
                <th>Type</th>
                <th>Book</th>
                {isLib && <th>Member</th>}
                <th>Needed until</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id}>
                  <td>{typeBadge(r.type)}</td>
                  <td>
                    {r.book?.title}
                    <span className="cell-sub">{r.book?.author}</span>
                  </td>
                  {isLib && (
                    <td>
                      {r.member?.name}
                      <span className="cell-sub">{r.member?.email}</span>
                    </td>
                  )}
                  <td>{formatDate(r.dueDate)}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>{r.reviewNote || "-"}</td>
                  <td>
                    {isLib ? (
                      <button className="btn btn-soft btn-sm" onClick={() => openReview(r)}>
                        {r.status === "pending" ? "Review" : "View"}
                      </button>
                    ) : (
                      r.status === "pending" && (
                        <button className="btn btn-danger btn-sm" onClick={() => setToCancel(r)}>
                          Cancel
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

      {selected && (
        <Modal
          title={selected.type === "reissue" ? "Reissue request" : "Borrow request"}
          onClose={() => setSelected(null)}
        >
          {formError && <div className="alert-error">{formError}</div>}

          <div className="detail-list">
            <p><span>Book</span>{selected.book?.title}</p>
            <p><span>Member</span>{selected.member?.name}</p>
            {selected.type === "borrow" ? (
              <p><span>Copies left</span>{selected.book?.availableCopies}</p>
            ) : (
              <p><span>Current due</span>{formatDate(selected.issue?.dueDate)}</p>
            )}
            <p><span>Needed until</span>{formatDate(selected.dueDate)}</p>
            <p><span>Status</span>{statusBadge(selected.status)}</p>
            {selected.status !== "pending" && (
              <p><span>Note</span>{selected.reviewNote || "-"}</p>
            )}
          </div>

          {selected.status === "pending" ? (
            <>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="note">Note to member (required when rejecting)</label>
                <textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError("");
                  }}
                />
                {noteError && <span className="error-text">{noteError}</span>}
              </div>
              <div className="modal-actions">
                <button className="btn btn-danger" onClick={() => review("rejected")} disabled={saving}>
                  <XIcon size={16} /> Reject
                </button>
                <button className="btn" onClick={() => review("approved")} disabled={saving}>
                  <CheckIcon size={16} /> Approve
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

      {toCancel && (
        <Modal title="Cancel request" onClose={() => setToCancel(null)}>
          <p>
            Cancel your request for <strong>{toCancel.book?.title}</strong>?
          </p>
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToCancel(null)}>
              Keep
            </button>
            <button className="btn btn-danger" onClick={confirmCancel} disabled={saving}>
              {saving ? "Cancelling..." : "Cancel request"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
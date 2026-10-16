import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate } from "../utils/format";
import { reviewSchema } from "../schemas/requestSchema";
import { statusBadge } from "./PurchaserRequests";
import Modal from "../components/Modal";
import { CheckIcon, XIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function LibrarianRequests() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/purchase-requests", { params: tab ? { status: tab } : {} });
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

  const openReview = (r) => {
    setSelected(r);
    setNote("");
    setNoteError("");
    setFormError("");
  };

  const review = async (status) => {
    setNoteError("");
    setFormError("");

    const parsed = reviewSchema.safeParse({ reviewNote: note });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0].message);
      return;
    }

    const payload = { status };
    if (parsed.data.reviewNote) payload.reviewNote = parsed.data.reviewNote;

    setSaving(true);
    try {
      await api.patch(`/purchase-requests/${selected._id}/review`, payload);
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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Requests</h2>
          <p>Review book requests from members.</p>
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
                <th>Book</th>
                <th>Requested by</th>
                <th>Qty</th>
                <th>Needed until</th>
                <th>Date</th>
                <th>Status</th>
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
                  <td>
                    {r.requestedBy?.name}
                    <span className="cell-sub">{r.requestedBy?.email}</span>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{formatDate(r.neededUntil)}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    <button className="btn btn-soft btn-sm" onClick={() => openReview(r)}>
                      {r.status === "pending" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Modal title="Purchase request" onClose={() => setSelected(null)}>
          {formError && <div className="alert-error">{formError}</div>}

          <div className="detail-list">
            <p><span>Title</span>{selected.title}</p>
            <p><span>Author</span>{selected.author}</p>
            {selected.isbn && <p><span>ISBN</span>{selected.isbn}</p>}
            <p><span>Quantity</span>{selected.quantity}</p>
            <p><span>Needed until</span>{formatDate(selected.neededUntil)}</p>
            <p><span>Requested by</span>{selected.requestedBy?.name}</p>
            <p><span>Reason</span>{selected.reason || "-"}</p>
            <p><span>Status</span>{statusBadge(selected.status)}</p>
            {selected.status !== "pending" && (
              <p><span>Note</span>{selected.reviewNote || "-"}</p>
            )}
          </div>

          {selected.status === "pending" ? (
            <>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="note">Note to member (optional)</label>
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
    </>
  );
}
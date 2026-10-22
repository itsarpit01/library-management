import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate, dateInput, toDateInput } from "../utils/format";
import { reviewSchema } from "../schemas/requestSchema";
import { statusBadge } from "./PurchaserRequests";
import Modal from "../components/Modal";
import IssueFormModal from "../components/IssueFormModal";
import { CheckIcon, XIcon } from "../components/Icons";

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

  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [noteError, setNoteError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [issueModalData, setIssueModalData] = useState(null);

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
    setNote(r.reviewNote || "");
    setProposedDate(r.proposedDate ? toDateInput(r.proposedDate) : r.neededUntil ? toDateInput(r.neededUntil) : dateInput(3));
    setNoteError("");
    setFormError("");
  };

  const review = async (status) => {
    setNoteError("");
    setFormError("");

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
      load();

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
          isLockedFromRequest: true, // ← Locks fields in IssueFormModal
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
                <th>Proposed return</th>
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
                  <td>{r.proposedDate ? formatDate(r.proposedDate) : "-"}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    <button className="btn btn-soft btn-sm" onClick={() => openReview(r)}>
                      {r.status === "pending" || r.status === "counter_offered" ? "Review" : "View"}
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
            {selected.proposedDate && (
              <p><span>Proposed return date</span>{formatDate(selected.proposedDate)}</p>
            )}
            <p><span>Requested by</span>{selected.requestedBy?.name}</p>
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
                  value={proposedDate}
                  onChange={(e) => setProposedDate(e.target.value)}
                />
                <span className="hint">If you select an earlier date, use "Propose Date" to negotiate with the user.</span>
              </div>

              <div className="field">
                <label htmlFor="note">Note to member (optional)</label>
                <textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError("");
                  }}
                  placeholder="e.g., Can only issue till this date due to high demand."
                />
                {noteError && <span className="error-text">{noteError}</span>}
              </div>

              {selected.status === "counter_offered" && (
                <p className="hint" style={{ color: "#ed6c02", marginBottom: 10 }}>
                  ⚠️ Counter-offer is active. Waiting for member to accept or edit their request before issuing.
                </p>
              )}

              <div className="modal-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                <button className="btn btn-danger" onClick={() => review("rejected")} disabled={saving}>
                  <XIcon size={16} /> Reject
                </button>
                <button className="btn btn-soft" onClick={() => review("counter_offered")} disabled={saving}>
                  Propose Date
                </button>
                <button
                  className="btn"
                  onClick={() => review("approved")}
                  disabled={saving || selected.status === "counter_offered"} // ← Point 3: Disabled when in counter_offered
                  title={selected.status === "counter_offered" ? "Cannot issue while counter offer is pending user acceptance" : "Approve and issue"}
                >
                  <CheckIcon size={16} /> Approve & Issue
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

      {issueModalData && (
        <IssueFormModal
          initial={issueModalData}
          onClose={() => setIssueModalData(null)}
          onSaved={() => {
            setIssueModalData(null);
            load();
          }}
        />
      )}
    </>
  );
}
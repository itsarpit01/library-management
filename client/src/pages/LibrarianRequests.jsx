import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate, dateInput, toDateInput } from "../utils/format";
import { reviewSchema } from "../schemas/requestSchema";
import { getEffectiveTier } from "../utils/membershipConfig";
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

  // Requesting member ka membership tier
  const memberTier = getEffectiveTier(selected?.requestedBy);

  // Date matching validation
  const userNeededDate = selected?.neededUntil ? toDateInput(selected.neededUntil) : "";
  const isDateMismatch = Boolean(selected && proposedDate && userNeededDate && proposedDate !== userNeededDate);
  const isCounterOffered = selected?.status === "counter_offered";

  // Approve tabhi allow hoga jab: not saving, not counter_offered, AUR dono dates exactly match karein
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

  // Helper: Member Tier Badge (0 Emojis, clean SVGs)
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{r.requestedBy?.name}</span>
                      {renderTierBadge(r.requestedBy?.membership)}
                    </div>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      Date mismatch: Click <strong>"Propose Date"</strong> to negotiate with the user first.
                    </span>
                  )}
                </span>
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

              {isCounterOffered && (
                <p
                  className="hint"
                  style={{
                    color: "#ed6c02",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Counter-offer is active. Waiting for member to accept or edit their request before issuing.
                </p>
              )}

              <div className="modal-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                <button className="btn btn-danger" onClick={() => review("rejected")} disabled={saving}>
                  <XIcon size={16} /> Reject
                </button>
                <button
                  className="btn btn-soft"
                  onClick={() => review("counter_offered")}
                  disabled={saving || !isDateMismatch}
                  title={!isDateMismatch ? "Date matches requested date. Choose a different date to propose." : "Send counter offer with alternate date"}
                >
                  Propose Date
                </button>
                <button
                  className="btn"
                  onClick={() => review("approved")}
                  disabled={!canApprove}
                  title={
                    isCounterOffered
                      ? "Cannot issue while counter offer is pending user acceptance"
                      : isDateMismatch
                      ? "Dates do not match. Propose alternate date to user first."
                      : "Approve and issue"
                  }
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
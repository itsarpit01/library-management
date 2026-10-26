import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { makeDueDateFormSchema } from "../schemas/issueSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, formatDate, toDateInput } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";

// mode: "direct" (librarian) ya "request" (purchaser)
export default function ReissueModal({ issue, mode, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();

  const isRequest = mode === "request";
  // Purchaser side par apna plan, librarian side par issue ke member ka plan
  const tier = isRequest ? getEffectiveTier(user) : getEffectiveTier(issue.member);

  const [dueDate, setDueDate] = useState(
    issue.reissueRequestedDate ? toDateInput(issue.reissueRequestedDate) : dateInput(1)
  );
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentDue = toDateInput(issue.dueDate);

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = makeDueDateFormSchema(tier.maxIssueDays).safeParse({ dueDate });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (dueDate <= currentDue) return setError("New date must be after the current due date");

    setSaving(true);
    try {
      if (isRequest) {
        await api.patch(`/issues/${issue._id}/request-reissue`, { dueDate });
        toast.success("Reissue request sent to librarian");
      } else {
        await api.patch(`/issues/${issue._id}/reissue`, { dueDate });
        toast.success("Book reissued successfully");
      }
      onSaved();
    } catch (err) {
      const fe = getFieldErrors(err);
      if (fe.dueDate) setError(fe.dueDate);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isRequest ? "Request reissue" : "Reissue book"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        <div className="detail-list">
          <p><span>Book</span>{issue.book?.title}</p>
          <p><span>Current due</span>{formatDate(issue.dueDate)}</p>
          <p><span>Reissued</span>{issue.reissueCount || 0} time(s)</p>
          <p>
            <span>Member Plan</span>
            <strong style={{ color: tier.color, textTransform: "capitalize" }}>{tier.name}</strong>
          </p>
          {issue.reissueRequested && (
            <p>
              <span>Requested date</span>
              <strong style={{ color: "var(--primary, #5c6bc0)" }}>
                {formatDate(issue.reissueRequestedDate)}
              </strong>
            </p>
          )}
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="dueDate">{isRequest ? "Requested new return date" : "New return date"}</label>
          <input
            id="dueDate"
            type="date"
            min={dateInput(1)}
            max={dateInput(tier.maxIssueDays)}
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              setError("");
            }}
          />
          {error ? (
            <span className="error-text">{error}</span>
          ) : (
            <span className="hint">
              Max {tier.maxIssueDays} days from today for <strong>{tier.name}</strong> membership.
            </span>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Saving..." : isRequest ? "Send reissue request" : "Confirm Reissue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
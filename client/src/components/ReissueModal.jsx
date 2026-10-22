import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { dueDateFormSchema } from "../schemas/issueSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, formatDate, toDateInput, MAX_ISSUE_DAYS } from "../utils/format";

// mode: "direct" (librarian) ya "request" (purchaser)
export default function ReissueModal({ issue, mode, onClose, onSaved }) {
  const toast = useToast();
  const [dueDate, setDueDate] = useState(dateInput(MAX_ISSUE_DAYS));
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentDue = toDateInput(issue.dueDate);
  const isRequest = mode === "request";

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = dueDateFormSchema.safeParse({ dueDate });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (dueDate <= currentDue) return setError("New date must be after the current due date");

    setSaving(true);
    try {
      if (isRequest) {
        await api.post("/borrow-requests", { type: "reissue", issueId: issue._id, dueDate });
        toast.success("Reissue request sent to librarian");
      } else {
        await api.patch(`/issues/${issue._id}/reissue`, { dueDate });
        toast.success("Book reissued");
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
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="dueDate">New return date</label>
          <input
            id="dueDate"
            type="date"
            min={dateInput(1)}
            max={dateInput(MAX_ISSUE_DAYS)}
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              setError("");
            }}
          />
          {error ? (
            <span className="error-text">{error}</span>
          ) : (
            <span className="hint">Max {MAX_ISSUE_DAYS} days from today.</span>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Saving..." : isRequest ? "Send request" : "Reissue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
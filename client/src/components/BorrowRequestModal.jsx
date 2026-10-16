import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { dueDateFormSchema } from "../schemas/issueSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, MAX_ISSUE_DAYS } from "../utils/format";

export default function BorrowRequestModal({ book, onClose, onSaved }) {
  const toast = useToast();
  const [dueDate, setDueDate] = useState(dateInput(14));
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = dueDateFormSchema.safeParse({ dueDate });
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setSaving(true);
    try {
      await api.post("/borrow-requests", { type: "borrow", bookId: book._id, dueDate });
      toast.success("Borrow request sent to librarian");
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
    <Modal title="Request to borrow" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" value={book.title} readOnly />
        </div>

        <div className="field">
          <label htmlFor="author">Author</label>
          <input id="author" value={book.author} readOnly />
        </div>

        <div className="field">
          <label htmlFor="dueDate">I need it until</label>
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
            <span className="hint">
              Max {MAX_ISSUE_DAYS} days. After that you can request a reissue.
            </span>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Sending..." : "Send request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { issueFormSchema } from "../schemas/issueSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, MAX_ISSUE_DAYS } from "../utils/format";

const toList = (data) => (Array.isArray(data) ? data : data?.data || []);

export default function IssueFormModal({ onClose, onSaved }) {
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [form, setForm] = useState({ memberId: "", bookId: "", dueDate: dateInput(14) });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/users/members"),
      api.get("/books", { params: { available: "true", limit: 50, sort: "title" } }),
    ])
      .then(([m, b]) => {
        setMembers(toList(m.data));
        setBooks(toList(b.data));
      })
      .catch((err) => setFormError(getErrorMessage(err)))
      .finally(() => setLoadingLists(false));
  }, []);

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = issueFormSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
      });
      setErrors(fe);
      return;
    }

    setSaving(true);
    try {
      await api.post("/issues", parsed.data);
      toast.success("Book issued");
      onSaved();
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Issue book" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        <div className="field">
          <label htmlFor="memberId">Member</label>
          <select id="memberId" name="memberId" value={form.memberId} onChange={change} disabled={loadingLists}>
            <option value="">{loadingLists ? "Loading..." : "Select member"}</option>
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
          {errors.memberId && <span className="error-text">{errors.memberId}</span>}
        </div>

        <div className="field">
          <label htmlFor="bookId">Book</label>
          <select id="bookId" name="bookId" value={form.bookId} onChange={change} disabled={loadingLists}>
            <option value="">{loadingLists ? "Loading..." : "Select book"}</option>
            {books.map((b) => (
              <option key={b._id} value={b._id}>
                {b.title} - {b.author} ({b.availableCopies} left)
              </option>
            ))}
          </select>
          {errors.bookId && <span className="error-text">{errors.bookId}</span>}
          {!loadingLists && books.length === 0 && (
            <span className="hint">No books with available copies.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="dueDate">Return by</label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            min={dateInput(1)}
            max={dateInput(MAX_ISSUE_DAYS)}
            value={form.dueDate}
            onChange={change}
          />
          {errors.dueDate ? (
            <span className="error-text">{errors.dueDate}</span>
          ) : (
            <span className="hint">Max {MAX_ISSUE_DAYS} days. After that the book must be reissued.</span>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving || loadingLists}>
            {saving ? "Issuing..." : "Issue book"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
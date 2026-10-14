import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { makeRequestFormSchema, makeEditRequestSchema } from "../schemas/requestSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";

export default function RequestFormModal({ initial = {}, request, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(request);

  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [form, setForm] = useState({
    bookId: request?.book || initial.bookId || "",
    quantity: request?.quantity ?? 1,
    reason: request?.reason || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/books", { params: { limit: 50, sort: "title" } })
      .then((res) => setBooks(res.data.data))
      .catch((err) => setFormError(getErrorMessage(err)))
      .finally(() => setLoadingBooks(false));
  }, []);

  const selected = isEdit
    ? books.find((b) => b._id === request.book || (request.isbn && b.isbn === request.isbn))
    : books.find((b) => b._id === form.bookId);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const pickBook = (e) => {
    setForm((f) => ({ ...f, bookId: e.target.value, quantity: 1 }));
    setErrors((er) => ({ ...er, bookId: undefined, quantity: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const schema = isEdit
      ? makeEditRequestSchema(selected?.totalCopies)
      : makeRequestFormSchema(selected?.totalCopies);
    const parsed = schema.safeParse(form);
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
      if (isEdit) {
        await api.patch(`/purchase-requests/${request._id}`, parsed.data);
        toast.success("Request updated");
      } else {
        await api.post("/purchase-requests", parsed.data);
        toast.success("Request sent to librarian");
      }
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
    <Modal title={isEdit ? "Edit request" : "Request a book"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        <div className="field">
          <label htmlFor="bookId">Title</label>
          {isEdit ? (
            <input id="bookId" value={request.title} readOnly />
          ) : (
            <select
              id="bookId"
              name="bookId"
              value={form.bookId}
              onChange={pickBook}
              disabled={loadingBooks}
            >
              <option value="">{loadingBooks ? "Loading books..." : "Select a book"}</option>
              {books.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.title}
                </option>
              ))}
            </select>
          )}
          {errors.bookId && <span className="error-text">{errors.bookId}</span>}
        </div>

        <div className="field">
          <label htmlFor="author">Author</label>
          <input
            id="author"
            value={isEdit ? request.author : selected?.author || ""}
            readOnly
            placeholder="Auto-filled"
          />
        </div>

        <div className="field">
          <label htmlFor="isbn">ISBN</label>
          <input
            id="isbn"
            value={isEdit ? request.isbn || "" : selected?.isbn || ""}
            readOnly
            placeholder="Auto-filled"
          />
        </div>

        <div className="field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={selected?.totalCopies || undefined}
            value={form.quantity}
            onChange={change}
            disabled={!isEdit && !selected}
          />
          {selected && !errors.quantity && (
            <span className="hint">Library has {selected.totalCopies} copies (max you can request)</span>
          )}
          {errors.quantity && <span className="error-text">{errors.quantity}</span>}
        </div>

        <div className="field">
          <label htmlFor="reason">Reason</label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            value={form.reason}
            onChange={change}
            placeholder="Why do you need this book?"
          />
          {errors.reason && <span className="error-text">{errors.reason}</span>}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving || loadingBooks}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Send request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
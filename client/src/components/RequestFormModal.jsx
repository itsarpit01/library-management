import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { makeRequestFormSchema } from "../schemas/requestSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, toDateInput, MAX_ISSUE_DAYS } from "../utils/format";

export default function RequestFormModal({ initial = {}, request, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(request);

  // Card se "Request this book" dabane par bookId pehle se pata hota hai:
  // tab title fixed dikhta hai, dropdown nahi.
  const lockedId = !isEdit ? initial.bookId || "" : "";
  const isLocked = Boolean(lockedId);

  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [form, setForm] = useState({
    bookId: request?.book || initial.bookId || "",
    quantity: request?.quantity ?? 1,
    neededUntil: request?.neededUntil ? toDateInput(request.neededUntil) : dateInput(14),
    reason: request?.reason || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isLocked) {
          const res = await api.get(`/books/${lockedId}`);
          if (!cancelled) setBooks([res.data]);
        } else {
          const res = await api.get("/books", { params: { limit: 50, sort: "title" } });
          if (cancelled) return;
          const list = res.data.data;
          setBooks(list);
          // Purani request mein book id nahi hoti, ISBN se match karo
          if (request && !request.book && request.isbn) {
            const match = list.find((b) => b.isbn === request.isbn);
            if (match) setForm((f) => ({ ...f, bookId: match._id }));
          }
        }
      } catch (err) {
        if (!cancelled) setFormError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingBooks(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [request, isLocked, lockedId]);

  const selected = books.find((b) => b._id === form.bookId);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const pickBook = (e) => {
    // Book badalne par quantity wapas 1
    setForm((f) => ({ ...f, bookId: e.target.value, quantity: 1 }));
    setErrors((er) => ({ ...er, bookId: undefined, quantity: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = makeRequestFormSchema(selected?.totalCopies).safeParse(form);
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

  const modalTitle = isEdit ? "Edit request" : isLocked ? "Request this book" : "Request a book";

  return (
    <Modal title={modalTitle} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        <div className="field">
          <label htmlFor="bookId">Title</label>
          {isLocked ? (
            <input
              id="bookId"
              value={selected?.title || (loadingBooks ? "Loading..." : "")}
              readOnly
            />
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
          <input id="author" value={selected?.author || ""} readOnly placeholder="Auto-filled" />
        </div>

        <div className="field">
          <label htmlFor="isbn">ISBN</label>
          <input id="isbn" value={selected?.isbn || ""} readOnly placeholder="Auto-filled" />
        </div>

        <div className="field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={selected?.totalCopies || 1}
            value={form.quantity}
            onChange={change}
            disabled={!selected}
          />
          {selected && !errors.quantity && (
            <span className="hint">Library has {selected.totalCopies} copies (max you can request)</span>
          )}
          {errors.quantity && <span className="error-text">{errors.quantity}</span>}
        </div>

        <div className="field">
          <label htmlFor="neededUntil">Needed until</label>
          <input
            id="neededUntil"
            name="neededUntil"
            type="date"
            min={dateInput(1)}
            max={dateInput(MAX_ISSUE_DAYS)}
            value={form.neededUntil}
            onChange={change}
          />
          {errors.neededUntil ? (
            <span className="error-text">{errors.neededUntil}</span>
          ) : (
            <span className="hint">Max {MAX_ISSUE_DAYS} days. After that, ask for a reissue.</span>
          )}
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
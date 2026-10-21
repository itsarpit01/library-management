import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { makeRequestFormSchema } from "../schemas/requestSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, toDateInput, formatDate, MAX_ISSUE_DAYS } from "../utils/format";
import { statusBadge } from "../pages/PurchaserRequests";

export default function RequestFormModal({ initial = {}, request, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(request);

  const lockedId = !isEdit ? initial.bookId || "" : "";
  const isLocked = Boolean(lockedId);

  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [myRequests, setMyRequests] = useState([]);
  const [form, setForm] = useState({
    bookId: request?.book || initial.bookId || "",
    quantity: request?.quantity ?? 1,
    neededUntil: request?.neededUntil ? toDateInput(request.neededUntil) : dateInput(MAX_ISSUE_DAYS),
    reason: request?.reason || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Load user's existing requests to check for duplicate active requests
        if (!isEdit) {
          const reqRes = await api.get("/purchase-requests/my");
          if (!cancelled) setMyRequests(reqRes.data);
        }

        if (isLocked) {
          const res = await api.get(`/books/${lockedId}`);
          if (!cancelled) setBooks([res.data]);
        } else {
          const res = await api.get("/books", { params: { limit: 50, sort: "title" } });
          if (cancelled) return;
          const list = res.data.data;
          setBooks(list);
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
  }, [request, isLocked, lockedId, isEdit]);

  const selected = books.find((b) => b._id === form.bookId);

  // Check if user already has an active request for this selected book
  const existingActiveRequest = !isEdit && form.bookId
    ? myRequests.find(
        (r) =>
          (r.book === form.bookId || r.book?._id === form.bookId) &&
          ["pending", "counter_offered", "approved"].includes(r.status)
      )
    : null;

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
    if (existingActiveRequest) return;
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

        {/* Existing Request Status Alert */}
        {existingActiveRequest && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              backgroundColor: "rgba(237, 108, 2, 0.1)",
              border: "1px solid #ed6c02",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ color: "#ed6c02", fontSize: 14 }}>
                Active request already exists!
              </strong>
              {statusBadge(existingActiveRequest.status)}
            </div>
            <p style={{ margin: "2px 0", fontSize: 13, color: "var(--text, #333)" }}>
              You already requested this book on <strong>{formatDate(existingActiveRequest.createdAt)}</strong> (Qty: {existingActiveRequest.quantity}).
            </p>
            {existingActiveRequest.neededUntil && (
              <p style={{ margin: "2px 0", fontSize: 13, color: "var(--text, #333)" }}>
                Needed until: <strong>{formatDate(existingActiveRequest.neededUntil)}</strong>
              </p>
            )}
            {existingActiveRequest.reviewNote && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary, #666)" }}>
                Note: {existingActiveRequest.reviewNote}
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="bookId">
            Title
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
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
          <label htmlFor="quantity">
            Quantity
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={selected?.totalCopies || 1}
            value={form.quantity}
            onChange={change}
            disabled={!selected || Boolean(existingActiveRequest)}
          />
          {selected && !errors.quantity && (
            <span className="hint">Library has {selected.totalCopies} copies (max you can request)</span>
          )}
          {errors.quantity && <span className="error-text">{errors.quantity}</span>}
        </div>

        <div className="field">
          <label htmlFor="neededUntil">
            Needed until
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
          <input
            id="neededUntil"
            name="neededUntil"
            type="date"
            min={dateInput(1)}
            max={dateInput(MAX_ISSUE_DAYS)}
            value={form.neededUntil}
            onChange={change}
            disabled={Boolean(existingActiveRequest)}
          />
          {errors.neededUntil ? (
            <span className="error-text">{errors.neededUntil}</span>
          ) : (
            <span className="hint">Max {MAX_ISSUE_DAYS} days. After that, ask for a reissue.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="reason">
            Reason
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            value={form.reason}
            onChange={change}
            placeholder="Why do you need this book?"
            disabled={Boolean(existingActiveRequest)}
          />
          {errors.reason && <span className="error-text">{errors.reason}</span>}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            {existingActiveRequest ? "Close" : "Cancel"}
          </button>
          {!existingActiveRequest && (
            <button type="submit" className="btn" disabled={saving || loadingBooks}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Send request"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
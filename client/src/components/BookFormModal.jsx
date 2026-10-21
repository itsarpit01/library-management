import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { bookFormSchema } from "../schemas/bookSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";

const SERVER_URL = "http://localhost:5000";
const empty = { title: "", author: "", isbn: "", category: "", price: "", totalCopies: 1 };

export default function BookFormModal({ book, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(book);

  const [form, setForm] = useState(
    isEdit
      ? {
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          category: book.category || "",
          price: book.price,
          totalCopies: book.totalCopies,
        }
      : empty
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(
    isEdit && book.coverImage ? `${SERVER_URL}${book.coverImage}` : null
  );

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = bookFormSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path[0];
        if (!fe[key]) fe[key] = i.message;
      });
      setErrors(fe);
      return;
    }

    const payload = { ...parsed.data };
    if (!payload.category) delete payload.category;

    const fd = new FormData();
    Object.entries(payload).forEach(([key, val]) => fd.append(key, val));
    if (coverFile) fd.append("coverImage", coverFile);

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/books/${book._id}`, fd);
        toast.success("Book updated");
      } else {
        await api.post("/books", fd);
        toast.success("Book added");
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

  const Field = ({ name, label, type = "text", hint, required = false, ...rest }) => (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>}
      </label>
      <input id={name} name={name} type={type} value={form[name]} onChange={change} {...rest} />
      {hint && !errors[name] && <span className="hint">{hint}</span>}
      {errors[name] && <span className="error-text">{errors[name]}</span>}
    </div>
  );

  return (
    <Modal title={isEdit ? "Edit book" : "Add book"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        {Field({ name: "title", label: "Title", required: true })}
        {Field({ name: "author", label: "Author", required: true })}
        {Field({ name: "isbn", label: "ISBN", hint: "10 or 13 digits, hyphens allowed", required: true })}
        {Field({ name: "category", label: "Category" })}

        <div className="form-row">
          {Field({ name: "price", label: "Price (₹)", type: "number", min: 0, required: true })}
          {Field({ name: "totalCopies", label: "Total copies", type: "number", min: 1, required: true })}
        </div>

        <div className="field">
          <label htmlFor="coverImage">Cover Image</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {coverPreview && (
              <span style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
                <img
                  src={coverPreview}
                  alt="cover"
                  style={{ width: 56, height: 72, borderRadius: 6, objectFit: "cover" }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: -4,
                    right: -4,
                    background: "var(--primary, #5c6bc0)",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid white",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </span>
              </span>
            )}
            <input
              id="coverImage"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleCoverChange}
            />
          </div>
          <span className="hint">Max 2MB. Formats: jpeg, png, webp</span>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add book"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
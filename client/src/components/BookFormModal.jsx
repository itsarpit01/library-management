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

  const Field = ({ name, label, type = "text", hint, ...rest }) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={form[name]} onChange={change} {...rest} />
      {hint && !errors[name] && <span className="hint">{hint}</span>}
      {errors[name] && <span className="error-text">{errors[name]}</span>}
    </div>
  );

  return (
    <Modal title={isEdit ? "Edit book" : "Add book"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        {Field({ name: "title", label: "Title" })}
        {Field({ name: "author", label: "Author" })}
        {Field({ name: "isbn", label: "ISBN", hint: "10 or 13 digits, hyphens allowed" })}
        {Field({ name: "category", label: "Category" })}

        <div className="form-row">
          {Field({ name: "price", label: "Price (₹)", type: "number", min: 0 })}
          {Field({ name: "totalCopies", label: "Total copies", type: "number", min: 1 })}
        </div>

        <div className="field">
          <label htmlFor="coverImage">Cover Image</label>
          <input
            id="coverImage"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleCoverChange}
          />
          {coverPreview && (
            <img
              src={coverPreview}
              alt="cover preview"
              style={{ marginTop: 8, maxHeight: 120, borderRadius: 6, objectFit: "cover" }}
            />
          )}
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
import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { requestFormSchema } from "../schemas/requestSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";

const empty = { title: "", author: "", isbn: "", quantity: 1, estimatedPrice: "", reason: "" };

export default function RequestFormModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...empty, ...initial });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsed = requestFormSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
      });
      setErrors(fe);
      return;
    }

    const { isbn, estimatedPrice, reason, ...rest } = parsed.data;
    const payload = { ...rest };
    if (isbn) payload.isbn = isbn;
    if (estimatedPrice !== "") payload.estimatedPrice = Number(estimatedPrice);
    if (reason) payload.reason = reason;

    setSaving(true);
    try {
      await api.post("/purchase-requests", payload);
      toast.success("Request sent to librarian");
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
    <Modal title="Request a book" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        {Field({ name: "title", label: "Title" })}
        {Field({ name: "author", label: "Author" })}
        {Field({ name: "isbn", label: "ISBN (optional)", hint: "10 or 13 digits" })}

        <div className="form-row">
          {Field({ name: "quantity", label: "Quantity", type: "number", min: 1 })}
          {Field({ name: "estimatedPrice", label: "Estimated price (₹)", type: "number", min: 0 })}
        </div>

        <div className="field">
          <label htmlFor="reason">Reason (optional)</label>
          <textarea id="reason" name="reason" rows={3} value={form.reason} onChange={change} />
          {errors.reason && <span className="error-text">{errors.reason}</span>}
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
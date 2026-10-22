import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";
import { issueFormSchema } from "../schemas/issueSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, toDateInput, formatDate, MAX_ISSUE_DAYS } from "../utils/format";

const toList = (data) => (Array.isArray(data) ? data : data?.data || []);

export default function IssueFormModal({ initial = {}, onClose, onSaved }) {
  const toast = useToast();
  const isLocked = Boolean(initial.isLockedFromRequest);

  const [requests, setRequests] = useState([]);
  const [loadingLists, setLoadingLists] = useState(!isLocked);

  const [form, setForm] = useState({
    memberId: initial.memberId || "",
    bookId: initial.bookId || "",
    dueDate: initial.dueDate ? toDateInput(initial.dueDate) : dateInput(1), // ← Defaults to tomorrow
    requestId: initial.requestId || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLocked) return;

    api.get("/purchase-requests")
      .then((res) => {
        const allRequests = toList(res.data);
        const activeRequests = allRequests.filter((r) =>
          ["pending", "approved", "counter_offered"].includes(r.status) && r.requestedBy && (r.book || r._id)
        );
        setRequests(activeRequests);
      })
      .catch((err) => setFormError(getErrorMessage(err)))
      .finally(() => setLoadingLists(false));
  }, [isLocked]);

  const requestedMembers = [];
  const memberMap = new Map();
  requests.forEach((r) => {
    const user = r.requestedBy;
    if (user && !memberMap.has(user._id)) {
      memberMap.set(user._id, true);
      requestedMembers.push(user);
    }
  });

  const eligibleBooks = requests
    .filter((r) => !form.memberId || r.requestedBy?._id === form.memberId)
    .map((r) => ({
      bookId: r.book?._id || r.book,
      title: r.title,
      author: r.author,
      neededUntil: r.neededUntil,
      requestId: r._id,
    }))
    .filter((b, idx, arr) => b.bookId && arr.findIndex((x) => x.bookId === b.bookId) === idx);

  const handleMemberChange = (e) => {
    const memberId = e.target.value;
    const memberReqs = requests.filter((r) => r.requestedBy?._id === memberId);
    let autoBookId = "";
    let autoDueDate = dateInput(1); // ← Defaults to tomorrow
    let autoRequestId = "";

    if (memberReqs.length === 1) {
      autoBookId = memberReqs[0].book?._id || memberReqs[0].book || "";
      autoRequestId = memberReqs[0]._id;
      if (memberReqs[0].neededUntil) {
        autoDueDate = toDateInput(memberReqs[0].neededUntil);
      }
    }

    setForm({
      memberId,
      bookId: autoBookId,
      dueDate: autoDueDate,
      requestId: autoRequestId,
    });
    setErrors((er) => ({ ...er, memberId: undefined, bookId: undefined }));
  };

  const handleBookChange = (e) => {
    const bookId = e.target.value;
    const matchedReq = requests.find(
      (r) => (!form.memberId || r.requestedBy?._id === form.memberId) && (r.book?._id === bookId || r.book === bookId)
    );

    setForm((f) => ({
      ...f,
      bookId,
      requestId: matchedReq?._id || "",
      dueDate: matchedReq?.neededUntil ? toDateInput(matchedReq.neededUntil) : f.dueDate,
    }));
    setErrors((er) => ({ ...er, bookId: undefined }));
  };

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
      await api.post("/issues", { ...parsed.data, requestId: form.requestId });
      toast.success("Book issued successfully");
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
    <Modal title={isLocked ? "Confirm book issue" : "Issue book"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert-error">{formError}</div>}

        <div className="field">
          <label htmlFor="memberId">
            Member
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
          {isLocked ? (
            <input
              id="memberId"
              value={`${initial.member?.name || "Member"} (${initial.member?.email || ""})`}
              readOnly
            />
          ) : (
            <select id="memberId" name="memberId" value={form.memberId} onChange={handleMemberChange} disabled={loadingLists}>
              <option value="">{loadingLists ? "Loading..." : "Select requesting member"}</option>
              {requestedMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          )}
          {errors.memberId && <span className="error-text">{errors.memberId}</span>}
        </div>

        <div className="field">
          <label htmlFor="bookId">
            Book
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
          {isLocked ? (
            <input
              id="bookId"
              value={`${initial.book?.title || "Book"} - ${initial.book?.author || ""}`}
              readOnly
            />
          ) : (
            <select id="bookId" name="bookId" value={form.bookId} onChange={handleBookChange} disabled={loadingLists || !form.memberId}>
              <option value="">
                {!form.memberId ? "Select a member first" : eligibleBooks.length === 0 ? "No requested books" : "Select requested book"}
              </option>
              {eligibleBooks.map((b) => (
                <option key={b.bookId} value={b.bookId}>
                  {b.title} - {b.author}
                </option>
              ))}
            </select>
          )}
          {errors.bookId && <span className="error-text">{errors.bookId}</span>}
        </div>

        <div className="field">
          <label htmlFor="dueDate">
            Return by (Agreed date)
            <span style={{ color: "var(--danger, #e53935)", marginLeft: 4 }}>*</span>
          </label>
          {isLocked ? (
            <input
              id="dueDate"
              value={formatDate(form.dueDate)}
              readOnly
            />
          ) : (
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              min={dateInput(1)}
              max={dateInput(MAX_ISSUE_DAYS)}
              value={form.dueDate}
              onChange={change}
            />
          )}
          {errors.dueDate ? (
            <span className="error-text">{errors.dueDate}</span>
          ) : isLocked ? (
            <span className="hint">Pre-set from member's agreed request date.</span>
          ) : (
            <span className="hint">Max {MAX_ISSUE_DAYS} days. After that the book must be reissued.</span>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={saving || (!isLocked && (loadingLists || requestedMembers.length === 0))}>
            {saving ? "Issuing..." : "Confirm & Issue book"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
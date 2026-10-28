import { useEffect, useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import MembershipModal from "./MembershipModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { makeRequestFormSchema } from "../schemas/requestSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { dateInput, toDateInput } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import { statusBadge } from "../pages/PurchaserRequests";

export default function RequestFormModal({ initial = {}, request, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = Boolean(request);

  const lockedId = !isEdit ? initial.bookId || "" : "";
  const isLocked = Boolean(lockedId);

  // User ka effective active tier
  const tier = getEffectiveTier(user);

  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [myRequests, setMyRequests] = useState([]);
  const [myActiveIssues, setMyActiveIssues] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [form, setForm] = useState({
    bookId: request?.book || initial.bookId || "",
    quantity: request?.quantity ?? 1,
    neededUntil: request?.neededUntil ? toDateInput(request.neededUntil) : dateInput(1),
    reason: request?.reason || "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!isEdit) {
          const [reqRes, issueRes] = await Promise.all([
            api.get("/purchase-requests/my"),
            api.get("/issues/my").catch(() => ({ data: [] })),
          ]);
          if (!cancelled) {
            setMyRequests(reqRes.data);
            const activeIssues = (Array.isArray(issueRes.data) ? issueRes.data : []).filter(
              (i) => i.status === "issued"
            );
            setMyActiveIssues(activeIssues);
          }
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

  // Active slots: Pending/Counter Requests + Currently Issued Books
  const activeRequestsCount = myRequests.filter(
    (r) => ["pending", "counter_offered"].includes(r.status)
  ).length;
  const totalActiveUsed = activeRequestsCount + myActiveIssues.length;

  const isLimitReached =
    !isEdit && tier.maxBooks !== Infinity && totalActiveUsed >= tier.maxBooks;

  const existingActiveRequest = !isEdit && form.bookId
    ? myRequests.find((r) => {
        const isThisBook = r.book === form.bookId || r.book?._id === form.bookId;
        if (!isThisBook) return false;

        if (["pending", "counter_offered"].includes(r.status)) return true;

        if (r.status === "approved") {
          return myActiveIssues.some(
            (i) => i.book?._id === form.bookId || i.book === form.bookId
          );
        }
        return false;
      })
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
    if (existingActiveRequest || isLimitReached) return;
    setFormError("");

    // Date limit tier se aati hai (Free: 14, Premium: 30, Ultimate: all upcoming)
    const parsed = makeRequestFormSchema(selected?.totalCopies, tier.maxIssueDays).safeParse(form);
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
        await api.patch(`/purchase-requests/${request._id}`, {
          bookId: form.bookId,
          quantity: Number(form.quantity),
          neededUntil: form.neededUntil,
          reason: form.reason,
        });
        toast.success("Request updated");
      } else {
        await api.post("/purchase-requests", {
          bookId: form.bookId,
          quantity: Number(form.quantity),
          neededUntil: form.neededUntil,
          reason: form.reason,
        });
        toast.success("Request submitted");
      }

      // ⚡ Real-Time Signal: Sidebar aur App ko turant update karne ke liye
      window.dispatchEvent(new Event("quota-updated"));

      onSaved();
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length > 0) setErrors(fe);
      else setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = isEdit ? "Edit book request" : "Request a book";

  return (
    <>
      <Modal title={modalTitle} onClose={onClose}>
        <form onSubmit={submit} noValidate>
          {formError && <div className="alert-error">{formError}</div>}

          {isLimitReached && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                backgroundColor: "rgba(229, 57, 53, 0.1)",
                border: "1px solid var(--danger, #e53935)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "var(--danger, #e53935)", fontSize: 14 }}>
                  Tier Limit Reached ({totalActiveUsed}/{tier.maxBooks} active requests/books)
                </strong>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowUpgradeModal(true)}
                  style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                >
                  Upgrade Plan
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text, #333)" }}>
                Your <strong>{tier.name}</strong> membership allows a maximum of {tier.maxBooks} active requests & issued books. Return a book, cancel a pending request, or upgrade to request more.
              </p>
            </div>
          )}

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
                  Active request or issue exists!
                </strong>
                {statusBadge(existingActiveRequest.status)}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text, #333)" }}>
                You already have an active request or an issued copy of <strong>{selected?.title || "this book"}</strong>. Wait for it to be returned or closed before requesting again.
              </p>
            </div>
          )}

          <div className="field">
            <label htmlFor="bookId">Book</label>
            {isLocked ? (
              <input value={selected?.title || "Loading..."} readOnly />
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
                    {b.title} — {b.author} ({b.availableCopies} available)
                  </option>
                ))}
              </select>
            )}
            {errors.bookId && <span className="error-text">{errors.bookId}</span>}
          </div>

          <div className="field">
            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              max={selected ? selected.totalCopies : 1}
              value={form.quantity}
              onChange={change}
            />
            {errors.quantity ? (
              <span className="error-text">{errors.quantity}</span>
            ) : selected ? (
              <span className="hint">Library has {selected.totalCopies} total copies.</span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="neededUntil">Needed until</label>
            <input
              id="neededUntil"
              name="neededUntil"
              type="date"
              min={dateInput(1)}
              max={
                tier.tier !== "ultimate" && tier.maxIssueDays !== Infinity
                  ? dateInput(tier.maxIssueDays)
                  : undefined
              }
              value={form.neededUntil}
              onChange={change}
            />
            {errors.neededUntil ? (
              <span className="error-text">{errors.neededUntil}</span>
            ) : (
              <span className="hint">
                Plan limit: <strong>{tier.tier === "ultimate" ? "All upcoming dates available" : `Max ${tier.maxIssueDays} days`}</strong>.
              </span>
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
            <button
              type="submit"
              className="btn"
              disabled={saving || Boolean(existingActiveRequest) || isLimitReached}
            >
              {saving ? "Saving..." : isEdit ? "Update Request" : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}
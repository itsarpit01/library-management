import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import IssueFormModal from "../components/IssueFormModal";
import ReissueModal from "../components/ReissueModal";
import Modal from "../components/Modal";
import { PlusIcon, ReturnIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "issued", label: "Issued" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
];

export default function LibrarianIssues() {
  const toast = useToast();

  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [toReturn, setToReturn] = useState(null);
  const [toReissue, setToReissue] = useState(null);
  const [returning, setReturning] = useState(false);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab ? { status: tab } : {};
      const res = await api.get("/issues", { params });
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleIssued = () => {
    setShowForm(false);
    loadIssues();
  };

  const handleReissued = () => {
    setToReissue(null);
    loadIssues();
  };

  const confirmReturn = async () => {
    setReturning(true);
    try {
      const res = await api.patch(`/issues/${toReturn._id}/return`);
      const fine = res.data.fine ?? res.data.currentFine ?? 0;
      toast.success(fine > 0 ? `Book returned. Fine: ₹${fine}` : "Book returned");
      setToReturn(null);
      loadIssues();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setToReturn(null);
    } finally {
      setReturning(false);
    }
  };

  const statusBadge = (i) => {
    if (i.status === "returned") return <span className="badge badge-success">Returned</span>;
    if (i.isOverdue) return <span className="badge badge-danger">Overdue</span>;
    if (i.reissueRequested) {
      return (
        <span className="badge" style={{ backgroundColor: "#fff3e0", color: "#e65100", border: "1px solid #ffb74d" }}>
          Reissue Requested
        </span>
      );
    }
    if (i.reissueCount > 0) {
      return (
        <span
          className="badge"
          style={{ backgroundColor: "var(--primary-subtle, #ede7f6)", color: "var(--primary, #5c6bc0)", border: "1px solid var(--primary, #5c6bc0)" }}
        >
          Reissued
        </span>
      );
    }
    return <span className="badge badge-warning">Issued</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Issue / Return</h2>
          <p>Issue books to members and take them back.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>
          <PlusIcon size={18} /> Issue book
        </button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">Loading...</p>
      ) : issues.length === 0 ? (
        <p className="empty">No records found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Member</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Status</th>
                <th>Fine</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i._id}>
                  <td>
                    {i.book?.title}
                    <span className="cell-sub">{i.book?.author}</span>
                  </td>
                  <td>
                    {i.member?.name}
                    <span className="cell-sub">{i.member?.email}</span>
                  </td>
                  <td>{formatDate(i.issueDate)}</td>
                  <td>
                    {formatDate(i.dueDate)}
                    {i.reissueCount > 0 && (
                      <span className="cell-sub">Reissued {i.reissueCount}x</span>
                    )}
                  </td>
                  <td>{formatDate(i.returnDate)}</td>
                  <td>{statusBadge(i)}</td>
                  <td>{i.currentFine > 0 ? `₹${i.currentFine}` : "-"}</td>
                  <td>
                    {i.status === "issued" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={i.reissueRequested ? "btn btn-sm" : "btn btn-soft btn-sm"}
                          onClick={() => setToReissue(i)}
                          title={i.reissueRequested ? `Member requested extension till ${formatDate(i.reissueRequestedDate)}` : "Reissue book"}
                        >
                          {i.reissueRequested ? "Review Reissue" : "Reissue"}
                        </button>
                        <button className="btn btn-soft btn-sm" onClick={() => setToReturn(i)}>
                          <ReturnIcon size={16} /> Return
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <IssueFormModal onClose={() => setShowForm(false)} onSaved={handleIssued} />}

      {toReissue && (
        <ReissueModal
          issue={toReissue}
          mode="direct"
          onClose={() => setToReissue(null)}
          onSaved={handleReissued}
        />
      )}

      {toReturn && (
        <Modal title="Return book" onClose={() => setToReturn(null)}>
          <p>
            Mark <strong>{toReturn.book?.title}</strong> as returned by <strong>{toReturn.member?.name}</strong>?
          </p>
          {toReturn.currentFine > 0 && (
            <p style={{ marginTop: 10 }}>
              <span className="badge badge-danger">Late fine: ₹{toReturn.currentFine}</span>
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-soft" onClick={() => setToReturn(null)}>
              Cancel
            </button>
            <button className="btn" onClick={confirmReturn} disabled={returning}>
              {returning ? "Returning..." : "Confirm return"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
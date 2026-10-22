import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import ReissueModal from "../components/ReissueModal";
import Modal from "../components/Modal";
import { ReturnIcon } from "../components/Icons";

const TABS = [
  { key: "", label: "All" },
  { key: "issued", label: "Issued" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
];

export default function PurchaserIssues() {
  const toast = useToast();
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [toReissue, setToReissue] = useState(null);
  const [toReturn, setToReturn] = useState(null);
  const [returning, setReturning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/issues/my");
      setIssues(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = issues.filter((i) => {
    if (tab === "issued") return i.status === "issued";
    if (tab === "overdue") return i.status === "issued" && i.isOverdue;
    if (tab === "returned") return i.status === "returned";
    return true;
  });

  const confirmReturn = async () => {
    setReturning(true);
    try {
      const res = await api.patch(`/issues/${toReturn._id}/return`);
      const fine = res.data.fine ?? res.data.currentFine ?? 0;
      toast.success(fine > 0 ? `Book returned. Late fine: ₹${fine}` : "Book returned successfully");
      setToReturn(null);
      load();
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
          <h2>My Issues</h2>
          <p>Books issued to you, due dates and fines. You can return or request a reissue.</p>
        </div>
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
      ) : visible.length === 0 ? (
        <p className="empty">No records found.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Status</th>
                <th>Fine</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i._id}>
                  <td>
                    {i.book?.title}
                    <span className="cell-sub">{i.book?.author}</span>
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
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {!i.reissueRequested && (i.reissueCount || 0) < 2 && (
                          <button className="btn btn-soft btn-sm" onClick={() => setToReissue(i)}>
                            Reissue
                          </button>
                        )}
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

      {toReissue && (
        <ReissueModal
          issue={toReissue}
          mode="request"
          onClose={() => setToReissue(null)}
          onSaved={() => {
            setToReissue(null);
            load();
          }}
        />
      )}

      {toReturn && (
        <Modal title="Return book" onClose={() => setToReturn(null)}>
          <p>
            Are you sure you want to return <strong>{toReturn.book?.title}</strong>?
          </p>
          {toReturn.currentFine > 0 && (
            <p style={{ marginTop: 10 }}>
              <span className="badge badge-danger">Late fine applicable: ₹{toReturn.currentFine}</span>
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
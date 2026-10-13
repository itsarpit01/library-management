import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";

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

  // /issues/my status filter nahi leta, isliye tab frontend par filter hota hai
  const visible = issues.filter((i) => {
    if (tab === "issued") return i.status === "issued";
    if (tab === "overdue") return i.status === "issued" && i.isOverdue;
    if (tab === "returned") return i.status === "returned";
    return true;
  });

  const statusBadge = (i) => {
    if (i.status === "returned") return <span className="badge badge-success">Returned</span>;
    if (i.isOverdue) return <span className="badge badge-danger">Overdue</span>;
    return <span className="badge badge-warning">Issued</span>;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Issues</h2>
          <p>Books issued to you, due dates and fines.</p>
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
                  <td>{formatDate(i.dueDate)}</td>
                  <td>{formatDate(i.returnDate)}</td>
                  <td>{statusBadge(i)}</td>
                  <td>{i.currentFine > 0 ? `₹${i.currentFine}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
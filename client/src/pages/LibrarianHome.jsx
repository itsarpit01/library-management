import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate, daysLate } from "../utils/format";
import StatCard from "../components/StatCard";
import { BookIcon, IssueIcon, ClockIcon, RequestIcon } from "../components/Icons";

export default function LibrarianHome() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard")
      .then((res) => setStats(res.data))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <p className="empty">Loading dashboard...</p>;
  if (!stats) return <p className="empty">Could not load dashboard.</p>;

  const { books, issues, purchaseRequests, recentIssues, overdueIssues } = stats;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your library.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={BookIcon}
          label="Book titles"
          value={books.totalTitles}
          hint={`${books.availableCopies} of ${books.totalCopies} copies available`}
        />
        <StatCard icon={IssueIcon} label="Currently issued" value={issues.issuedCount} tone="success" />
        <StatCard icon={ClockIcon} label="Overdue" value={issues.overdueCount} tone="danger" />
        <StatCard
          icon={RequestIcon}
          label="Pending requests"
          value={purchaseRequests.pending}
          tone="warning"
        />
      </div>

      <div className="section-grid">
        <div className="card">
          <div className="section-title">
            <h3>Overdue books</h3>
            <Link to="/librarian/issues">View all</Link>
          </div>
          {overdueIssues.length === 0 ? (
            <p className="empty">No overdue books.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Book</th><th>Member</th><th>Late</th></tr>
                </thead>
                <tbody>
                  {overdueIssues.map((i) => (
                    <tr key={i._id}>
                      <td>{i.book?.title}</td>
                      <td>{i.member?.name}</td>
                      <td><span className="badge badge-danger">{daysLate(i.dueDate)} days</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Recent issues</h3>
            <Link to="/librarian/issues">View all</Link>
          </div>
          {recentIssues.length === 0 ? (
            <p className="empty">No books issued yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Book</th><th>Member</th><th>Due</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentIssues.map((i) => (
                    <tr key={i._id}>
                      <td>{i.book?.title}</td>
                      <td>{i.member?.name}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td>
                        <span className={`badge ${i.status === "returned" ? "badge-success" : "badge-warning"}`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
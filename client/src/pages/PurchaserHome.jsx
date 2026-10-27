import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import MembershipModal from "../components/MembershipModal";
import { statusBadge } from "./PurchaserRequests";
import { BookIcon, RequestIcon, IssueIcon } from "../components/Icons";

const SERVER_URL = "http://localhost:5000";

export default function PurchaserHome() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tier = getEffectiveTier(user);

  const [loading, setLoading] = useState(true);
  const [latestBooks, setLatestBooks] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [activeIssues, setActiveIssues] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [booksRes, reqRes, issueRes] = await Promise.all([
        // Top 5 Latest Books Added
        api.get("/books", { params: { limit: 5, sort: "-createdAt" } }),
        // User's Requests (sorted newest first)
        api.get("/purchase-requests/my"),
        // User's Issues
        api.get("/issues/my").catch(() => ({ data: [] })),
      ]);

      setLatestBooks(booksRes.data?.data || []);
      const allRequests = Array.isArray(reqRes.data) ? reqRes.data : [];
      setRecentRequests(allRequests.slice(0, 3)); // Top 3 recent

      const allIssues = Array.isArray(issueRes.data) ? issueRes.data : [];
      setActiveIssues(allIssues.filter((i) => i.status === "issued"));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Quota Math
  const pendingRequestsCount = recentRequests.filter((r) =>
    ["pending", "counter_offered"].includes(r.status)
  ).length;
  const totalActiveUsed = activeIssues.length + pendingRequestsCount;
  const remainingSlots =
    tier.maxBooks === Infinity ? Infinity : Math.max(0, tier.maxBooks - totalActiveUsed);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Welcome & Stats Header */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(92, 107, 192, 0.08), rgba(99, 102, 241, 0.02))",
          border: "1px solid rgba(92, 107, 192, 0.2)",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: "1.5rem" }}>
              Welcome back, {user?.name || "Reader"}!
            </h2>
            <p style={{ margin: 0, color: "var(--text-secondary, #666)", fontSize: "0.95rem" }}>
              Explore the latest library collection and track your active book requests.
            </p>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => setShowUpgradeModal(true)}
            style={{
              background:
                tier.tier === "ultimate"
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : tier.tier === "premium"
                  ? "linear-gradient(135deg, #6366f1, #4338ca)"
                  : "var(--primary, #5c6bc0)",
              color: "#fff",
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: 20,
            }}
          >
            {tier.name} Plan • {remainingSlots === Infinity ? "Unlimited" : `${remainingSlots} left`}
          </button>
        </div>

        {/* Quick Metric Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          <div
            className="card"
            style={{ padding: 14, cursor: "pointer", background: "var(--card-bg, #fff)" }}
            onClick={() => navigate("/purchaser/my-issues")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--primary, #5c6bc0)" }}><IssueIcon size={20} /></span>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>Active Issued</span>
            </div>
            <strong style={{ fontSize: "1.4rem", display: "block", marginTop: 4 }}>
              {activeIssues.length}
            </strong>
          </div>

          <div
            className="card"
            style={{ padding: 14, cursor: "pointer", background: "var(--card-bg, #fff)" }}
            onClick={() => navigate("/purchaser/requests")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#f59e0b" }}><RequestIcon size={20} /></span>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>Pending Requests</span>
            </div>
            <strong style={{ fontSize: "1.4rem", display: "block", marginTop: 4 }}>
              {pendingRequestsCount}
            </strong>
          </div>

          <div
            className="card"
            style={{ padding: 14, cursor: "pointer", background: "var(--card-bg, #fff)" }}
            onClick={() => navigate("/purchaser/books")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#10b981" }}><BookIcon size={20} /></span>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>Browse Catalog</span>
            </div>
            <strong style={{ fontSize: "1.4rem", display: "block", marginTop: 4 }}>
              Explore →
            </strong>
          </div>
        </div>
      </div>

      {/* Section 1: Top 5 Latest Books Added */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Latest Books in Library</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
              Recently cataloged books ready to borrow.
            </span>
          </div>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => navigate("/purchaser/books")}
          >
            View all books →
          </button>
        </div>

        {loading ? (
          <p className="empty">Loading latest arrivals...</p>
        ) : latestBooks.length === 0 ? (
          <p className="empty">No books available yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 16,
            }}
          >
            {latestBooks.map((b) => {
              const coverSrc = b.coverImage ? `${SERVER_URL}${b.coverImage}` : null;
              const isAvailable = b.availableCopies > 0;
              return (
                <div
                  key={b._id}
                  className="card"
                  onClick={() => navigate("/purchaser/books")}
                  style={{
                    cursor: "pointer",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "";
                  }}
                  title="Click to view in Browse Books"
                >
                  <div
                    style={{
                      height: 140,
                      borderRadius: 6,
                      background: "rgba(0,0,0,0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      marginBottom: 10,
                    }}
                  >
                    {coverSrc ? (
                      <img
                        src={coverSrc}
                        alt={b.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "2rem", color: "var(--primary, #5c6bc0)", fontWeight: 700 }}>
                        {b.title?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={b.title}>
                    {b.title}
                  </h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.author}
                  </span>
                  <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className={`badge ${isAvailable ? "badge-success" : "badge-danger"}`} style={{ fontSize: "0.72rem" }}>
                      {isAvailable ? `${b.availableCopies} avail` : "Out of stock"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--primary, #5c6bc0)", fontWeight: 600 }}>
                      Request →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Recent 3 Book Requests */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Recent Book Requests</h3>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
              Latest requests submitted to the librarian.
            </span>
          </div>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => navigate("/purchaser/requests")}
          >
            View all requests →
          </button>
        </div>

        {loading ? (
          <p className="empty">Loading requests...</p>
        ) : recentRequests.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ margin: "0 0 12px 0", color: "var(--text-secondary, #666)" }}>
              You haven&apos;t requested any books yet.
            </p>
            <button className="btn btn-sm" onClick={() => navigate("/purchaser/books")}>
              Browse Books to Request
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Book Title</th>
                  <th>Requested Date</th>
                  <th>Needed Until</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => navigate("/purchaser/requests")}
                    style={{ cursor: "pointer" }}
                    title="Click to view details in My Requests"
                  >
                    <td>
                      <strong>{r.title}</strong>
                      <span className="cell-sub" style={{ display: "inline-block", marginLeft: 6 }}>
                        by {r.author}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.neededUntil)}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ color: "var(--primary, #5c6bc0)", fontSize: "0.85rem", fontWeight: 600 }}>
                        Details →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpgradeModal && (
        <MembershipModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
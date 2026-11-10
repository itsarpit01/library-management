import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import Modal from "../components/Modal";
import { SearchIcon, BookIcon, ClockIcon } from "../components/Icons";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

const TIER_TABS = [
  { key: "", label: "All Plans" },
  { key: "free", label: "Free" },
  { key: "premium", label: "Premium" },
  { key: "ultimate", label: "Ultimate" },
];

export default function LibrarianUsers() {
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent_activity"); // Default: Recent activity/order first

  // Pagination (8 members per page)
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  // Detailed Activity Modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/users/members");
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Reset pagination on filter or sort change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, tierFilter, activityFilter, sortBy]);

  // Open detailed member activity modal
  const openActivity = async (member) => {
    setSelectedMember(member);
    setActivityLoading(true);
    try {
      const res = await api.get(`/users/members/${member._id}/activity`);
      setActivityData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActivityLoading(false);
    }
  };

  // Filtered and Sorted list calculation
  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchEmail = m.email?.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }

      if (tierFilter && m.membership?.tier !== tierFilter) {
        return false;
      }

      if (activityFilter === "with_books" && m.activeBooksCount <= 0) {
        return false;
      }
      if (activityFilter === "with_fines" && m.totalFines <= 0) {
        return false;
      }

      return true;
    });

    // Sort order logic
    const sorted = [...filtered];
    if (sortBy === "recent_activity") {
      sorted.sort(
        (a, b) =>
          new Date(b.lastActivityAt || b.createdAt).getTime() -
          new Date(a.lastActivityAt || a.createdAt).getTime()
      );
    } else if (sortBy === "joined") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "books") {
      sorted.sort((a, b) => (b.activeBooksCount || 0) - (a.activeBooksCount || 0));
    } else if (sortBy === "fines") {
      sorted.sort((a, b) => (b.totalFines || 0) - (a.totalFines || 0));
    }

    return sorted;
  }, [members, searchQuery, tierFilter, activityFilter, sortBy]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedMembers.length / PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAndSortedMembers.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedMembers, page]);

  // Quick Stats
  const totalCount = members.length;
  const paidCount = members.filter((m) => ["premium", "ultimate"].includes(m.membership?.tier)).length;
  const borrowingCount = members.filter((m) => m.activeBooksCount > 0).length;
  const finesTotal = members.reduce((sum, m) => sum + (m.totalFines || 0), 0);

  const renderTierBadge = (membership) => {
    const tier = membership?.tier || "free";
    if (tier === "ultimate") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.72rem",
            padding: "3px 9px",
          }}
        >
          Ultimate
        </span>
      );
    }
    if (tier === "premium") {
      return (
        <span
          className="badge"
          style={{
            background: "linear-gradient(135deg, #6366f1, #4338ca)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.72rem",
            padding: "3px 9px",
          }}
        >
          Premium
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          background: "var(--card-bg, #f3f4f6)",
          color: "#4b5563",
          fontSize: "0.72rem",
          padding: "3px 9px",
          border: "1px solid var(--border, #d1d5db)",
        }}
      >
        Free
      </span>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Member Records</h2>
          <p>Inspect registered library members, active subscriptions, and borrowing activity.</p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)" }}>Total Members</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginTop: 4 }}>{totalCount}</div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: "#4f46e5" }}>Active Paid Plans</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#4f46e5", marginTop: 4 }}>
            {paidCount}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: "#16a34a" }}>Currently Borrowing</span>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#16a34a", marginTop: 4 }}>
            {borrowingCount}
          </div>
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <span style={{ fontSize: "0.8rem", color: finesTotal > 0 ? "#dc2626" : "var(--text-secondary, #666)" }}>
            Total Unpaid Fines
          </span>
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: "bold",
              color: finesTotal > 0 ? "#dc2626" : "var(--text, #333)",
              marginTop: 4,
            }}
          >
            ₹{finesTotal}
          </div>
        </div>
      </div>

      {/* Toolbar with Tier Tabs, Search, Filter, and Sort */}
      <div
        className="toolbar"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TIER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab ${tierFilter === t.key ? "active" : ""}`}
              onClick={() => setTierFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary, #9ca3af)",
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="toolbar-input"
            placeholder="Search member by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>

        <select
          className="toolbar-input"
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="">All Members</option>
          <option value="with_books">With Active Books</option>
          <option value="with_fines">With Unpaid Fines</option>
        </select>

        {/* Sort selector defaulting to Recent Activity */}
        <select
          className="toolbar-input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ width: "auto", fontWeight: 600 }}
          title="Change sorting order"
        >
          <option value="recent_activity">Sort: Recent Book Order / Activity</option>
          <option value="joined">Sort: Recently Joined</option>
          <option value="books">Sort: Most Active Books</option>
          <option value="fines">Sort: Highest Fines</option>
        </select>
      </div>

      {/* Members Table */}
      {loading ? (
        <p className="empty">Loading members...</p>
      ) : filteredAndSortedMembers.length === 0 ? (
        <p className="empty">No members matching your filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Membership Tier</th>
                <th>Issued Books</th>
                <th>Pending Requests</th>
                <th>Fines Due</th>
                <th>Recent Activity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.map((m) => {
                const avatarSrc = m.avatar ? `${SERVER_URL}${m.avatar}` : null;

                return (
                  <tr key={m._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt=""
                            style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <span className="avatar avatar-sm">{m.name?.[0]?.toUpperCase()}</span>
                        )}
                        <div>
                          <strong>{m.name}</strong>
                          <span className="cell-sub">{m.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div>{renderTierBadge(m.membership)}</div>
                        {m.membership?.expiresAt && m.membership.tier !== "free" && (
                          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary, #666)" }}>
                            Exp: {formatDate(m.membership.expiresAt)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${m.activeBooksCount > 0 ? "badge-primary" : "badge-secondary"}`}
                        style={{ fontSize: "0.78rem" }}
                      >
                        {m.activeBooksCount} book(s)
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${m.pendingRequestsCount > 0 ? "badge-warning" : "badge-secondary"}`}
                        style={{ fontSize: "0.78rem" }}
                      >
                        {m.pendingRequestsCount} pending
                      </span>
                    </td>

                    <td>
                      <strong style={{ color: m.totalFines > 0 ? "#dc2626" : "#16a34a" }}>
                        ₹{m.totalFines}
                      </strong>
                    </td>

                    {/* Recent Activity and Joined Date */}
                    <td>
                      <div>
                        <strong>{formatDate(m.lastActivityAt || m.createdAt)}</strong>
                        <span
                          className="cell-sub"
                          style={{ fontSize: "0.72rem", color: "var(--text-secondary, #6b7280)", marginTop: 2 }}
                        >
                          Joined: {formatDate(m.createdAt)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <button
                        className="btn btn-soft btn-sm"
                        onClick={() => openActivity(m)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        View Activity
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18 }}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setPage(1)}
            disabled={page <= 1}
            title="First Page"
          >
            « First
          </button>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ‹ Prev
          </button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)", margin: "0 8px" }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next ›
          </button>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            title="Last Page"
          >
            Last »
          </button>
        </div>
      )}

      {/* Detailed Member Activity Modal */}
      {selectedMember && (
        <Modal
          title={`Member Activity: ${selectedMember.name}`}
          onClose={() => {
            setSelectedMember(null);
            setActivityData(null);
          }}
          maxWidth="680px"
        >
          {activityLoading ? (
            <p className="empty">Loading member history...</p>
          ) : !activityData ? (
            <p className="empty">No activity data found.</p>
          ) : (
            <div>
              {/* Member overview banner */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--card-bg, #f9fafb)",
                  borderRadius: 10,
                  border: "1px solid var(--border, #e5e7eb)",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700 }}>{activityData.member?.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary, #666)" }}>
                    {activityData.member?.email}
                  </div>
                </div>
                <div>{renderTierBadge(activityData.member?.membership)}</div>
              </div>

              {/* Currently Borrowed Books */}
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>
                Current & Past Issues ({activityData.issues?.length || 0})
              </h4>
              {(!activityData.issues || activityData.issues.length === 0) ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #888)", marginBottom: 16 }}>
                  No books issued to this member yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18, maxHeight: 180, overflowY: "auto" }}>
                  {activityData.issues.map((i) => (
                    <div
                      key={i._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        border: "1px solid var(--border, #e5e7eb)",
                        borderRadius: 8,
                        fontSize: "0.85rem",
                      }}
                    >
                      <div>
                        <strong>{i.book?.title}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)" }}>
                          Issued: {formatDate(i.issueDate)} | Due: {formatDate(i.dueDate)}
                        </div>
                      </div>
                      <span className={`badge ${i.status === "issued" ? "badge-warning" : "badge-success"}`}>
                        {i.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Purchase & Borrow Requests */}
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>
                Purchase & Borrow Requests ({activityData.requests?.length || 0})
              </h4>
              {(!activityData.requests || activityData.requests.length === 0) ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #888)", marginBottom: 16 }}>
                  No purchase or borrow requests submitted by this member.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                  {activityData.requests.map((r) => (
                    <div
                      key={r._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        border: "1px solid var(--border, #e5e7eb)",
                        borderRadius: 8,
                        fontSize: "0.85rem",
                      }}
                    >
                      <div>
                        <strong>{r.title}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)" }}>
                          Requested: {formatDate(r.createdAt)}
                        </div>
                      </div>
                      <span className={`badge badge-${r.status}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
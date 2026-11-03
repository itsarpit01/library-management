import { useCallback, useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";
import Modal from "../components/Modal";
import { SearchIcon, BookIcon, ClockIcon } from "../components/Icons";

const SERVER_URL = "http://localhost:5000";

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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState(""); // all, with_books, with_fines

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

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, tierFilter, activityFilter]);

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

  // Filtered list calculation
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchEmail = m.email?.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }

      // 2. Tier Filter
      if (tierFilter && m.membership?.tier !== tierFilter) {
        return false;
      }

      // 3. Activity Filter
      if (activityFilter === "with_books" && m.activeBooksCount <= 0) {
        return false;
      }
      if (activityFilter === "with_fines" && m.totalFines <= 0) {
        return false;
      }

      return true;
    });
  }, [members, searchQuery, tierFilter, activityFilter]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, page]);

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

      {/* Toolbar: Tier Tabs + Search + Activity Filter */}
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
        {/* Tier Tabs */}
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

        {/* Search */}
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

        {/* Activity Filter Dropdown */}
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
      </div>

      {/* Members Table */}
      {loading ? (
        <p className="empty">Loading members...</p>
      ) : filteredMembers.length === 0 ? (
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
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.map((m) => {
                const avatarSrc = m.avatar ? `${SERVER_URL}${m.avatar}` : null;

                return (
                  <tr key={m._id}>
                    {/* Member Info */}
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

                    {/* Tier */}
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

                    {/* Issued Books */}
                    <td>
                      <span
                        className={`badge ${m.activeBooksCount > 0 ? "badge-primary" : "badge-secondary"}`}
                        style={{ fontSize: "0.78rem" }}
                      >
                        {m.activeBooksCount} book(s)
                      </span>
                    </td>

                    {/* Pending Requests */}
                    <td>
                      <span
                        className={`badge ${m.pendingRequestsCount > 0 ? "badge-warning" : "badge-secondary"}`}
                        style={{ fontSize: "0.78rem" }}
                      >
                        {m.pendingRequestsCount} pending
                      </span>
                    </td>

                    {/* Fines */}
                    <td>
                      <strong style={{ color: m.totalFines > 0 ? "#dc2626" : "#16a34a" }}>
                        ₹{m.totalFines}
                      </strong>
                    </td>

                    {/* Joined Date */}
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(m.createdAt)}</td>

                    {/* Action */}
                    <td>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => openActivity(m)}
                      >
                        View Activity
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Member Activity & Details Modal */}
      {selectedMember && (
        <Modal title="Member Record & Activity" onClose={() => setSelectedMember(null)} maxWidth="740px">
          {activityLoading ? (
            <p className="empty">Loading activity history...</p>
          ) : (
            <div>
              {/* Member Overview Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  background: "var(--card-bg, #f9fafb)",
                  borderRadius: 10,
                  border: "1px solid var(--border, #e5e7eb)",
                  marginBottom: 16,
                }}
              >
                {selectedMember.avatar ? (
                  <img
                    src={`${SERVER_URL}${selectedMember.avatar}`}
                    alt=""
                    style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="avatar avatar-lg">{selectedMember.name?.[0]?.toUpperCase()}</span>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{selectedMember.name}</h3>
                    {renderTierBadge(selectedMember.membership)}
                  </div>
                  <span className="cell-sub">{selectedMember.email}</span>
                </div>
                <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--text-secondary, #666)" }}>
                  <div>Joined on {formatDate(selectedMember.createdAt)}</div>
                  {selectedMember.membership?.expiresAt && (
                    <div style={{ color: "#4f46e5", fontWeight: 600 }}>
                      Plan expires: {formatDate(selectedMember.membership.expiresAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Issued Books Section */}
              <h4 style={{ margin: "14px 0 8px 0" }}>Currently Borrowed Books</h4>
              {activityData?.issues?.filter((i) => i.status === "issued").length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
                  No books currently issued to this member.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginBottom: 16 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Book Title</th>
                        <th>Issued Date</th>
                        <th>Due Date</th>
                        <th>Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityData?.issues
                        ?.filter((i) => i.status === "issued")
                        .map((issue) => (
                          <tr key={issue._id}>
                            <td>
                              <strong>{issue.book?.title}</strong>
                              <span className="cell-sub">{issue.book?.author}</span>
                            </td>
                            <td>{formatDate(issue.issueDate)}</td>
                            <td>{formatDate(issue.dueDate)}</td>
                            <td>
                              <span style={{ color: issue.fine > 0 ? "#dc2626" : "inherit", fontWeight: 600 }}>
                                ₹{issue.fine}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent Requests Section */}
              <h4 style={{ margin: "14px 0 8px 0" }}>Recent Book Requests</h4>
              {activityData?.requests?.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
                  No request history found for this member.
                </p>
              ) : (
                <div className="table-wrap" style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Book</th>
                        <th>Requested Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityData?.requests?.slice(0, 5).map((r) => (
                        <tr key={r._id}>
                          <td>{r.title}</td>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>
                            <span className="badge" style={{ textTransform: "capitalize" }}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setSelectedMember(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
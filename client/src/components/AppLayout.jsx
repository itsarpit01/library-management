import { useEffect, useState, useCallback } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";
import MembershipModal from "./MembershipModal";
import ThemeToggle from "./ThemeToggle";
import { getEffectiveTier } from "../utils/membershipConfig";
import { BookIcon, DashboardIcon, IssueIcon, RequestIcon, LogoutIcon, MenuIcon } from "./Icons";

const SERVER_URL = "http://localhost:5000";

const NAV = {
  librarian: [
    { to: "/librarian", label: "Dashboard", icon: DashboardIcon, end: true },
    { to: "/librarian/books", label: "Books", icon: BookIcon },
    { to: "/librarian/issues", label: "Issue / Return", icon: IssueIcon },
    { to: "/librarian/requests", label: "Requests", icon: RequestIcon },
  ],
  purchaser: [
    { to: "/purchaser", label: "Dashboard", icon: DashboardIcon, end: true },
    { to: "/purchaser/books", label: "Browse Books", icon: BookIcon },
    { to: "/purchaser/my-issues", label: "My Issues", icon: IssueIcon },
    { to: "/purchaser/requests", label: "My Requests", icon: RequestIcon },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);

  // Active slots in sidebar
  const [sidebarCapacity, setSidebarCapacity] = useState({ active: 0, pending: 0 });

  const links = NAV[user?.role] || [];
  const avatarSrc = user?.avatar ? `${SERVER_URL}${user.avatar}` : null;
  const tier = getEffectiveTier(user);

  useEffect(() => {
    setAvatarBroken(false);
  }, [user?.avatar]);

  // Load quota for purchaser sidebar widget
  const loadSidebarQuota = useCallback(async () => {
    if (user?.role !== "purchaser") return;
    try {
      const [reqRes, issueRes] = await Promise.all([
        api.get("/purchase-requests/my").catch(() => ({ data: [] })),
        api.get("/issues/my").catch(() => ({ data: [] })),
      ]);
      const reqs = Array.isArray(reqRes.data) ? reqRes.data : [];
      const pending = reqs.filter((r) => ["pending", "counter_offered"].includes(r.status)).length;
      const issues = Array.isArray(issueRes.data) ? issueRes.data : [];
      const active = issues.filter((i) => i.status === "issued").length;
      setSidebarCapacity({ active, pending });
    } catch {
      // background silent
    }
  }, [user?.role]);

  useEffect(() => {
    loadSidebarQuota();
  }, [loadSidebarQuota]);

  const handleLogout = async () => {
    setConfirmLogout(false);
    setOpen(false);
    await logout();
    toast.info("Logged out");
    navigate("/login", { replace: true });
  };

  const totalUsed = sidebarCapacity.active + sidebarCapacity.pending;
  const remaining = tier.maxBooks === Infinity ? Infinity : Math.max(0, tier.maxBooks - totalUsed);
  const isFull = tier.maxBooks !== Infinity && totalUsed >= tier.maxBooks;
  const percentage = tier.maxBooks === Infinity ? 10 : Math.min(100, Math.round((totalUsed / tier.maxBooks) * 100));

  return (
    <div className="app">
      <div
        className={`overlay ${open ? "show" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="logo">
          <span className="logo-mark">
            <BookIcon size={18} />
          </span>
          LibraryHub
        </div>

        <nav className="nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Quota & Membership Widget for Purchaser */}
        {user?.role === "purchaser" && (
          <div
            style={{
              marginTop: "auto",
              padding: "12px 14px",
              background: "rgba(92, 107, 192, 0.08)",
              border: "1px solid rgba(92, 107, 192, 0.18)",
              borderRadius: 8,
              margin: "auto 12px 12px 12px",
              cursor: "pointer",
            }}
            onClick={() => setShowMembershipModal(true)}
            title="Click to view membership plans"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: isFull ? "#dc2626" : "var(--primary, #5c6bc0)",
                }}
              >
                {tier.name} Plan
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: isFull ? "#dc2626" : "var(--text, #333)",
                }}
              >
                {totalUsed} / {tier.maxBooks === Infinity ? "∞" : tier.maxBooks}
              </span>
            </div>

            <div style={{ width: "100%", height: 5, background: "rgba(0,0,0,0.08)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${percentage}%`,
                  background: isFull ? "#ef4444" : "var(--primary, #5c6bc0)",
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: "0.7rem", color: "var(--text-secondary, #666)" }}>
              <span>{isFull ? "Limit Reached" : `${remaining} slot(s) left`}</span>
              <span style={{ color: "var(--primary, #5c6bc0)", fontWeight: 600 }}>Upgrade →</span>
            </div>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-btn"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
          </div>

          <div className="topbar-right">
            <ThemeToggle />

            {/* Topbar Plan Pill */}
            {user?.role === "purchaser" && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowMembershipModal(true)}
                style={{
                  background:
                    tier.tier === "ultimate"
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : tier.tier === "premium"
                      ? "linear-gradient(135deg, #6366f1, #4338ca)"
                      : "linear-gradient(135deg, #f3e8ff, #ede9fe)",
                  color: tier.tier === "free" ? "#6d28d9" : "#fff",
                  border: tier.tier === "free" ? "1.5px solid #a78bfa" : "none",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  padding: "5px 12px",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                title="Click to view or upgrade your membership"
              >
                <span>{tier.name} Plan</span>
                {tier.tier === "free" && (
                  <span
                    style={{
                      background: "#7c3aed",
                      color: "#fff",
                      fontSize: "0.7rem",
                      padding: "1px 6px",
                      borderRadius: "10px",
                    }}
                  >
                    Upgrade
                  </span>
                )}
              </button>
            )}

            <Link to={`/${user.role}/profile`} className="profile-link" title="My profile">
              <div className="user-meta">
                <strong>{user.name}</strong>
                <span>{user.role}</span>
              </div>
              {avatarSrc && !avatarBroken ? (
                <img
                  className="avatar"
                  src={avatarSrc}
                  alt=""
                  onError={() => setAvatarBroken(true)}
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
              )}
            </Link>
            <button className="btn btn-soft btn-sm" onClick={() => setConfirmLogout(true)}>
              <LogoutIcon size={16} /> Logout
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {confirmLogout && (
        <ConfirmModal
          title="Logout"
          message="Are you sure you want to logout?"
          confirmText="Logout"
          danger
          onClose={() => setConfirmLogout(false)}
          onConfirm={handleLogout}
        />
      )}

      {showMembershipModal && (
        <MembershipModal onClose={() => setShowMembershipModal(false)} />
      )}
    </div>
  );
}
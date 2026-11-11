import { useEffect, useState, useCallback, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import api from "../api/axios";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";
import MembershipModal from "./MembershipModal";
import DeleteAccountModal from "./DeleteAccountModal";
import ThemeToggle from "./ThemeToggle";
import { getEffectiveTier } from "../utils/membershipConfig";
import {
  BookIcon,
  DashboardIcon,
  IssueIcon,
  RequestIcon,
  LogoutIcon,
  MenuIcon,
  UserIcon,
} from "./Icons";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

const NAV = {
  librarian: [
    { to: "/librarian", label: "Dashboard", icon: DashboardIcon, end: true },
    { to: "/librarian/books", label: "Books", icon: BookIcon },
    { to: "/librarian/issues", label: "Issue / Return", icon: IssueIcon },
    { to: "/librarian/requests", label: "Requests", icon: RequestIcon },
    { to: "/librarian/users", label: "Members", icon: UserIcon || DashboardIcon },
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
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);

  // Profile Dropdown state & ref
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef(null);

  // Active slots in sidebar
  const [sidebarCapacity, setSidebarCapacity] = useState({ active: 0, pending: 0 });

  const links = NAV[user?.role] || [];
  const avatarSrc = user?.avatar ? `${SERVER_URL}${user.avatar}` : null;
  const tier = getEffectiveTier(user);

  useEffect(() => {
    setAvatarBroken(false);
  }, [user?.avatar]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Real-time auto sync
  useEffect(() => {
    loadSidebarQuota();
    const interval = setInterval(loadSidebarQuota, 60000);
    const onQuotaUpdated = () => loadSidebarQuota();
    window.addEventListener("quotaUpdated", onQuotaUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener("quotaUpdated", onQuotaUpdated);
    };
  }, [loadSidebarQuota]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  const totalUsed = sidebarCapacity.active + sidebarCapacity.pending;
  const remaining = Math.max(0, tier.maxBooks - totalUsed);
  const isFull = tier.tier !== "ultimate" && totalUsed >= tier.maxBooks;
  const percentage =
    tier.tier === "ultimate"
      ? 100
      : Math.min(100, Math.round((totalUsed / tier.maxBooks) * 100));

  const upgradeLabel =
    tier.tier === "free"
      ? "Upgrade to Premium"
      : tier.tier === "premium"
      ? "Upgrade to Ultimate"
      : "Active";

  return (
    <div className="layout">
      {open && (
        <div
          className="drawer-overlay"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Link
            to={user?.role === "librarian" ? "/librarian" : "/purchaser"}
            className="brand-link"
            onClick={() => setOpen(false)}
          >
            <span className="brand-logo">
              <BookIcon />
            </span>
            <span className="brand-text">LibraryHub</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setOpen(false)}
              >
                <Icon />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {user?.role === "purchaser" && (
          <div
            onClick={() => {
              if (tier.tier !== "ultimate") setShowMembershipModal(true);
            }}
            style={{
              margin: "12px 14px",
              padding: "10px 12px",
              background: "var(--soft-1, rgba(92,107,192,0.06))",
              border: "1px solid var(--border, rgba(0,0,0,0.08))",
              borderRadius: 10,
              cursor: tier.tier !== "ultimate" ? "pointer" : "default",
              transition: "transform 0.15s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-secondary, #666)",
                }}
              >
                {tier.name} Capacity
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: isFull ? "#dc2626" : "var(--text, #333)",
                }}
              >
                {tier.tier === "ultimate" ? `${sidebarCapacity.active} issued` : `${totalUsed} / ${tier.maxBooks}`}
              </span>
            </div>

            {tier.tier !== "ultimate" && (
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
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: "0.7rem", color: "var(--text-secondary, #666)" }}>
              <span>
                {tier.tier === "ultimate"
                  ? "Unlimited capacity"
                  : isFull
                  ? "Limit Reached"
                  : `${remaining} slot(s) left`}
              </span>
              <span style={{ color: "var(--primary, #5c6bc0)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {upgradeLabel}
              </span>
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
            <NotificationBell />

            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: dropdownOpen ? "var(--soft-2, rgba(92,107,192,0.1))" : "transparent",
                  border: "1px solid",
                  borderColor: dropdownOpen ? "var(--border, #e5e7eb)" : "transparent",
                  borderRadius: 24,
                  padding: "4px 10px 4px 6px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {avatarSrc && !avatarBroken ? (
                  <img
                    className="avatar"
                    src={avatarSrc}
                    alt=""
                    onError={() => setAvatarBroken(true)}
                    style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="avatar" style={{ width: 34, height: 34, fontSize: "0.85rem" }}>
                    {user?.name?.[0]?.toUpperCase()}
                  </span>
                )}

                <div className="user-meta" style={{ textAlign: "left" }}>
                  <strong style={{ fontSize: "0.88rem", lineHeight: 1.2 }}>{user?.name}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)" }}>
                    {user?.role}
                  </span>
                </div>
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 250,
                    background: "var(--surface, #ffffff)",
                    border: "1px solid var(--border, #e5e7eb)",
                    borderRadius: 12,
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)",
                    padding: 6,
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: "8px 12px 10px 12px", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text, #111)" }}>
                      {user?.name}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary, #666)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user?.email}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 12,
                          display: "inline-block",
                          background:
                            user?.role === "purchaser"
                              ? tier.tier === "ultimate"
                                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                : tier.tier === "premium"
                                ? "linear-gradient(135deg, #6366f1, #4338ca)"
                                : "rgba(92, 107, 192, 0.1)"
                              : "rgba(92, 107, 192, 0.1)",
                          color:
                            user?.role === "purchaser" && tier.tier !== "free"
                              ? "#ffffff"
                              : "var(--primary, #5c6bc0)",
                          textTransform: "capitalize",
                        }}
                      >
                        {user?.role === "purchaser" ? `${tier.name} Plan` : `${user?.role} Staff`}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: "4px 0" }}>
                    <button
                      type="button"
                      className="nav-link"
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate(`/${user?.role}/profile?tab=profile`);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        border: "none",
                        background: "transparent",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: "0.88rem",
                        color: "var(--text, #333)",
                        textAlign: "left",
                      }}
                    >
                      <UserIcon size={16} />
                      <div>
                        <div style={{ fontWeight: 600, lineHeight: 1.2 }}>Profile</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary, #666)" }}>
                          {user?.role === "purchaser" ? "Plan & details" : "Account details"}
                        </div>
                      </div>
                    </button>

                    {user?.role === "purchaser" && (
                      <button
                        type="button"
                        className="nav-link"
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate(`/${user?.role}/profile?tab=transactions`);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          border: "none",
                          background: "transparent",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: "0.88rem",
                          color: "var(--text, #333)",
                          textAlign: "left",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                        <div>
                          <div style={{ fontWeight: 600, lineHeight: 1.2 }}>Transaction History</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary, #666)" }}>All payments & fines</div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      className="nav-link"
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate(`/${user?.role}/profile?tab=settings`);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        border: "none",
                        background: "transparent",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: "0.88rem",
                        color: "var(--text, #333)",
                        textAlign: "left",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      <div>
                        <div style={{ fontWeight: 600, lineHeight: 1.2 }}>Settings</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary, #666)" }}>Password & security</div>
                      </div>
                    </button>
                  </div>

                  <div style={{ height: 1, background: "var(--border, #f1f5f9)", margin: "4px 0" }} />

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      setConfirmLogout(true);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      border: "none",
                      background: "transparent",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "var(--text, #333)",
                      textAlign: "left",
                    }}
                  >
                    <LogoutIcon size={16} />
                    <span>Logout</span>
                  </button>

                  {/* Delete Account (Purchaser Only) */}
                  {user?.role === "purchaser" && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        setShowDeleteModal(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        marginTop: 2,
                        border: "none",
                        background: "transparent",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "#dc2626",
                        textAlign: "left",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                      <span>Delete Account</span>
                    </button>
                  )}
                </div>
              )}
            </div>
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

      {showDeleteModal && (
        <DeleteAccountModal
          userEmail={user?.email}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
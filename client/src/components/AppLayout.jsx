import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "./ConfirmModal";
import ThemeToggle from "./ThemeToggle";
import { BookIcon, DashboardIcon, IssueIcon, RequestIcon, LogoutIcon, MenuIcon } from "./Icons";

const NAV = {
  librarian: [
    { to: "/librarian", label: "Dashboard", icon: DashboardIcon, end: true },
    { to: "/librarian/books", label: "Books", icon: BookIcon },
    { to: "/librarian/issues", label: "Issue / Return", icon: IssueIcon },
    { to: "/librarian/requests", label: "Requests", icon: RequestIcon },
    { to: "/librarian/borrow-requests", label: "Borrow Requests", icon: IssueIcon },
  ],
  purchaser: [
    { to: "/purchaser", label: "Dashboard", icon: DashboardIcon, end: true },
    { to: "/purchaser/books", label: "Browse Books", icon: BookIcon },
    { to: "/purchaser/my-issues", label: "My Issues", icon: IssueIcon },
    { to: "/purchaser/requests", label: "My Requests", icon: RequestIcon },
    { to: "/purchaser/borrow-requests", label: "Borrow Requests", icon: IssueIcon },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const links = NAV[user.role] || [];

  const handleLogout = async () => {
    setConfirmLogout(false);
    setOpen(false);
    await logout(); // server cookie clear hone ke baad redirect
    toast.info("Logged out");
    navigate("/login", { replace: true });
  };

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
            <Link to={`/${user.role}/profile`} className="profile-link" title="My profile">
              <div className="user-meta">
                <strong>{user.name}</strong>
                <span>{user.role}</span>
              </div>
              <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
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
    </div>
  );
}
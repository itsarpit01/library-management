import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { BellIcon } from "./Icons";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Request browser desktop push permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      const newUnread = res.data.unreadCount || 0;

      // Agar naya notification aaya ho aur tab background me ho toh Desktop Push fire karein
      if (
        newUnread > unreadCount &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        const latest = res.data.notifications[0];
        if (latest) {
          new Notification(latest.title, {
            body: latest.message,
            icon: "/favicon.jpeg",
          });
        }
      }

      setUnreadCount(newUnread);
    } catch {
      // ignore silent fetch errors
    }
  }, [unreadCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s

    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchNotifications]);

  // Outside click closes dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, link) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (link) {
        setIsOpen(false);
        navigate(link);
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    const diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Pure SVG Bell Icon Button */}
      <button
        type="button"
        className="icon-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: isOpen ? "var(--card-bg, #f3f4f6)" : "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text, #374151)",
          transition: "background 0.2s",
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.68rem",
              fontWeight: 700,
              minWidth: 17,
              height: 17,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxShadow: "0 0 0 2px var(--card-bg, #fff)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 460,
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border, #e5e7eb)",
              background: "var(--card-bg, #fafafa)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: "0.95rem" }}>Notifications</strong>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#dc2626",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 10,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary, #4f46e5)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-secondary, #9ca3af)", fontSize: "0.88rem" }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleMarkAsRead(n._id, n.link)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border, #f3f4f6)",
                    background: n.read ? "transparent" : "var(--primary-subtle, rgba(79, 70, 229, 0.04))",
                    cursor: n.link ? "pointer" : "default",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Status Indicator Dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: n.read ? "transparent" : "#4f46e5",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <strong style={{ fontSize: "0.85rem", color: "var(--text, #111827)" }}>
                        {n.title}
                      </strong>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary, #9ca3af)", whiteSpace: "nowrap" }}>
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--text-secondary, #4b5563)", lineHeight: 1.35 }}>
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
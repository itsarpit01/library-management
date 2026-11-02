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
      // ignore
    }
  }, [unreadCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (id, link) => {
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

  // Single Notification Delete
  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  // Clear All Notifications from card
  const handleClearAll = async () => {
    setLoading(true);
    try {
      await api.delete("/notifications/clear-all");
      setNotifications([]);
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

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 350,
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
          {/* Header with Clear All */}
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
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary, #6b7280)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Clear all notifications"
              >
                Clear all
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
                  onClick={() => handleNotificationClick(n._id, n.link)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border, #f3f4f6)",
                    background: n.read ? "transparent" : "var(--primary-subtle, rgba(79, 70, 229, 0.04))",
                    cursor: n.link ? "pointer" : "default",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    transition: "background 0.15s",
                    position: "relative",
                  }}
                >
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
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
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

                  {/* Individual Delete [X] Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNotification(e, n._id)}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary, #9ca3af)",
                      cursor: "pointer",
                      fontSize: "14px",
                      lineHeight: 1,
                      padding: 2,
                    }}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
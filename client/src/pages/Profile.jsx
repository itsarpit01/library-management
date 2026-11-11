import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";
import ImageCropModal from "../components/ImageCropModal";
import MembershipModal from "../components/MembershipModal";
import { profileSchema, passwordFormSchema } from "../schemas/profileSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate } from "../utils/format";
import { getEffectiveTier } from "../utils/membershipConfig";
import { UserIcon } from "../components/Icons";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

const emptyPw = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: "profile" | "transactions" | "settings"
  const activeTab = searchParams.get("tab") || "profile";
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [rawAvatarSrc, setRawAvatarSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);

  // Active slots counts
  const [activeBooksCount, setActiveBooksCount] = useState(0);
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);

  // Transaction History State
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Pagination for Transaction History
  const [txPage, setTxPage] = useState(1);
  const txPerPage = 6;

  const [pw, setPw] = useState(emptyPw);
  const [pwErrors, setPwErrors] = useState({});
  const [pwFormError, setPwFormError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const tier = getEffectiveTier(user);

  const loadTransactions = useCallback(() => {
    if (user?.role !== "purchaser") return;
    setLoadingTransactions(true);
    api
      .get("/payment/my-transactions")
      .then((res) => setTransactions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoadingTransactions(false));
  }, [user?.role]);

  useEffect(() => {
    Promise.all([
      api.get("/users/me"),
      api.get("/issues/my").catch(() => ({ data: [] })),
      api.get("/purchase-requests/my").catch(() => ({ data: [] })),
    ])
      .then(([userRes, issueRes, reqRes]) => {
        setProfile(userRes.data);
        setName(userRes.data.name);

        const issues = Array.isArray(issueRes.data) ? issueRes.data : [];
        const activeIssues = issues.filter((i) => i.status === "issued").length;
        setActiveBooksCount(activeIssues);

        const requests = Array.isArray(reqRes.data) ? reqRes.data : [];
        const activeReqs = requests.filter((r) =>
          ["pending", "counter_offered"].includes(r.status)
        ).length;
        setActiveRequestsCount(activeReqs);
      })
      .catch((err) => toast.error(getErrorMessage(err)));

    loadTransactions();

    const onQuotaUpdated = () => {
      loadTransactions();
    };
    window.addEventListener("quota-updated", onQuotaUpdated);
    return () => window.removeEventListener("quota-updated", onQuotaUpdated);
  }, [toast, loadTransactions]);

  const processAvatar = (file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only image files (jpeg, jpg, png, webp) are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }
    setRawAvatarSrc(URL.createObjectURL(file));
    setShowCropper(true);
  };

  const handleCropComplete = (croppedFile) => {
    setAvatarFile(croppedFile);
    setAvatarPreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
  };

  const handleAvatarChange = (e) => {
    processAvatar(e.target.files[0]);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processAvatar(files[0]);
    }
  };

  const saveName = async (e) => {
    e.preventDefault();
    setNameError("");

    const parsed = profileSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message || "Invalid name");
      return;
    }

    setSavingName(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const res = await api.put("/users/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile(res.data);
      updateUser(res.data);
      setAvatarFile(null);
      toast.success("Profile updated");
    } catch (err) {
      setNameError(getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const changePw = (e) => {
    setPw((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const savePw = async (e) => {
    e.preventDefault();
    setPwFormError("");
    setPwErrors({});

    const parsed = passwordFormSchema.safeParse(pw);
    if (!parsed.success) {
      const fieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const fieldName = issue.path[0];
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      });
      setPwErrors(fieldErrors);
      return;
    }

    setSavingPw(true);
    try {
      await api.put("/users/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      toast.success("Password updated");
      setPw(emptyPw);
    } catch (err) {
      const fe = getFieldErrors(err);
      if (fe.currentPassword || fe.newPassword) setPwErrors(fe);
      else setPwFormError(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const avatarSrc = avatarPreview || (profile?.avatar ? `${SERVER_URL}${profile.avatar}` : null);
  const unchanged = name.trim() === (profile?.name ?? user?.name) && !avatarFile;

  // Active Capacity Math
  const totalActiveSlots = activeBooksCount + activeRequestsCount;
  const remainingSlots =
    tier.maxBooks === Infinity ? Infinity : Math.max(0, tier.maxBooks - totalActiveSlots);

  const usagePercentage =
    tier.maxBooks === Infinity
      ? 10
      : Math.min(100, Math.round((totalActiveSlots / tier.maxBooks) * 100));

  // Pagination for Transaction History
  const totalTxPages = Math.ceil(transactions.length / txPerPage) || 1;
  const paginatedTransactions = transactions.slice((txPage - 1) * txPerPage, txPage * txPerPage);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h2>Account Center</h2>
          <p>Manage your profile, view subscription limits, and monitor transactions.</p>
        </div>
      </div>

      {/* Modern Profile Tabs Header */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 24,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          style={{
            padding: "9px 18px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.92rem",
            color: activeTab === "profile" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: activeTab === "profile" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease",
          }}
        >
          <UserIcon size={16} />
          <span>Profile</span>
        </button>

        {user?.role === "purchaser" && (
          <button
            type="button"
            onClick={() => {
              setActiveTab("transactions");
              setTxPage(1);
            }}
            style={{
              padding: "9px 18px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.92rem",
              color: activeTab === "transactions" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
              borderBottom: activeTab === "transactions" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Transaction History</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          style={{
            padding: "9px 18px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.92rem",
            color: activeTab === "settings" ? "var(--primary, #5c6bc0)" : "var(--text-secondary, #666)",
            borderBottom: activeTab === "settings" ? "2.5px solid var(--primary, #5c6bc0)" : "2.5px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: PROFILE DETAILS & RECENT 5 TRANSACTIONS                */}
      {/* ============================================================== */}
      {activeTab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            className="profile-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            {/* Card 1: Profile Details */}
            <form
              className="card"
              onSubmit={saveName}
              noValidate
              style={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              <div style={{ flex: 1 }}>
                <div className="profile-head">
                  <label
                    htmlFor="avatarInput"
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      cursor: "pointer",
                      position: "relative",
                      display: "inline-block",
                      padding: 4,
                      borderRadius: "50%",
                      border: isDragging ? "2px dashed var(--primary, #5c6bc0)" : "2px dashed transparent",
                      transform: isDragging ? "scale(1.12)" : "scale(1)",
                      transition: "all 0.2s ease",
                    }}
                    title="Click or drag and drop image here"
                  >
                    <div style={{ pointerEvents: "none" }}>
                      {avatarSrc ? (
                        <img
                          className="avatar avatar-lg"
                          src={avatarSrc}
                          alt="avatar"
                          style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <span className="avatar avatar-lg">{user?.name?.[0]?.toUpperCase()}</span>
                      )}
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          background: "var(--primary, #5c6bc0)",
                          color: "#fff",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          border: "2px solid #fff",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </span>
                    </div>
                  </label>
                  <input
                    id="avatarInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    style={{ display: "none" }}
                  />
                  <div>
                    <h3 style={{ margin: 0 }}>{profile?.name ?? user?.name}</h3>
                    <span className="cell-sub">{profile?.email ?? user?.email}</span>
                    <span
                      className="badge"
                      style={{
                        marginTop: 4,
                        display: "inline-block",
                        textTransform: "capitalize",
                      }}
                    >
                      {user?.role}
                    </span>
                  </div>
                </div>

                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="name">Full name</label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError("");
                    }}
                  />
                  {nameError && <span className="error-text">{nameError}</span>}
                </div>

                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" value={profile?.email || user?.email || ""} readOnly />
                  <span className="hint">Email cannot be changed.</span>
                </div>

                <div className="field">
                  <label>Member since</label>
                  <input value={profile ? formatDate(profile.createdAt) : "-"} readOnly />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "auto", paddingTop: 16 }}>
                <button type="submit" className="btn" disabled={savingName || unchanged}>
                  {savingName ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>

            {/* Card 2: Membership Capacity & Status Card */}
            {user.role === "purchaser" && (
              <div
                className="card"
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <h3 style={{ margin: 0 }}>My Membership</h3>
                    <span
                      className="badge"
                      style={{
                        background:
                          tier.tier === "ultimate"
                            ? "linear-gradient(135deg, #f59e0b, #d97706)"
                            : tier.tier === "premium"
                            ? "linear-gradient(135deg, #6366f1, #4338ca)"
                            : "var(--card-bg, #f3f4f6)",
                        color: tier.tier === "free" ? "#4b5563" : "#fff",
                        fontWeight: 700,
                        padding: "4px 10px",
                      }}
                    >
                      {tier.name} Plan
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#16a34a", fontWeight: 600, marginBottom: 14 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }}></span>
                    <span>Active Account • {tier.tier === "free" ? "Free Lifetime Access" : "Active Subscription"}</span>
                  </div>

                  {/* Meter */}
                  <div style={{ background: "rgba(92, 107, 192, 0.05)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
                      <span>{tier.tier === "ultimate" ? "Active Books" : "Active Capacity"}</span>
                      <span style={{ color: totalActiveSlots >= tier.maxBooks && tier.maxBooks !== Infinity ? "#dc2626" : "var(--primary, #5c6bc0)" }}>
                        {tier.tier === "ultimate"
                          ? `${activeBooksCount} issued`
                          : `${totalActiveSlots} / ${tier.maxBooks} slots`}
                      </span>
                    </div>

                    {tier.tier !== "ultimate" && (
                      <div style={{ width: "100%", height: 7, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${usagePercentage}%`,
                            background:
                              totalActiveSlots >= tier.maxBooks
                                ? "#ef4444"
                                : "var(--primary, #5c6bc0)",
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-secondary, #666)", marginTop: tier.tier === "ultimate" ? 0 : 6 }}>
                      {tier.tier === "ultimate" ? (
                        <span style={{ color: "var(--text-secondary, #666)" }}>
                          Unlimited Borrowing Capacity
                        </span>
                      ) : (
                        <>
                          <span>{activeBooksCount} issued • {activeRequestsCount} pending</span>
                          <strong style={{ color: totalActiveSlots >= tier.maxBooks ? "#dc2626" : "#16a34a" }}>
                            {remainingSlots} request slot(s) left
                          </strong>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary, #5c6bc0)" }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>
                        <strong>Reading Window:</strong>{" "}
                        {tier.tier === "ultimate" ? "All upcoming dates open" : `Up to ${tier.maxIssueDays} days`}
                      </span>
                    </div>

                    {user?.membership?.startedAt && tier.tier !== "free" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4f46e5" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span><strong>Started On:</strong> {formatDate(user.membership.startedAt)}</span>
                      </div>
                    )}

                    {user?.membership?.expiresAt && tier.tier !== "free" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#d97706" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span><strong>Expires:</strong> {formatDate(user.membership.expiresAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: "auto", paddingTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => setShowMembershipModal(true)}
                    style={{ width: "100%" }}
                  >
                    {tier.tier === "ultimate" ? "Your Plan" : "View Plans & Upgrade"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Recent 5 Transactions Only */}
          {user.role === "purchaser" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Recent Transactions</h3>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-secondary, #666)" }}>
                    Showing your latest 5 billing records.
                  </span>
                </div>
                {transactions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => {
                      setActiveTab("transactions");
                      setTxPage(1);
                    }}
                  >
                    View All ({transactions.length}) →
                  </button>
                )}
              </div>

              {loadingTransactions ? (
                <p className="empty">Loading recent transactions...</p>
              ) : transactions.length === 0 ? (
                <p className="empty">No transactions found yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type / Details</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Receipt ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 5).map((tx) => (
                        <tr key={tx._id}>
                          <td style={{ whiteSpace: "nowrap" }}>{formatDate(tx.createdAt)}</td>
                          <td style={{ whiteSpace: "nowrap", textTransform: "capitalize" }}>
                            {tx.type === "fine" ? (
                              <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c", fontSize: "0.72rem" }}>
                                Late Fine {tx.bookTitle ? `• ${tx.bookTitle}` : ""}
                              </span>
                            ) : (
                              <strong>{tx.tier} Plan</strong>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>₹{tx.amount}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span
                              className={`badge ${
                                tx.status === "success"
                                  ? "badge-success"
                                  : tx.status === "failed"
                                  ? "badge-danger"
                                  : "badge-warning"
                              }`}
                              style={{ textTransform: "capitalize" }}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem", color: "var(--text-secondary, #666)" }}>
                            {tx.paymentId || tx.orderId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: FULL TRANSACTION HISTORY (WITH PAGINATION)              */}
      {/* ============================================================== */}
      {activeTab === "transactions" && user.role === "purchaser" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem" }}>All Transaction Records</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
                Complete archive of your membership upgrades, renewals, and late fine settlements.
              </p>
            </div>
            <span className="badge" style={{ background: "rgba(99, 102, 241, 0.1)", color: "#4f46e5", fontWeight: 600, padding: "4px 12px" }}>
              Total: {transactions.length} record(s)
            </span>
          </div>

          {loadingTransactions ? (
            <p className="empty">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="empty">No payment transactions found.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: "nowrap" }}>Date</th>
                      <th style={{ whiteSpace: "nowrap" }}>Type / Details</th>
                      <th style={{ whiteSpace: "nowrap" }}>Amount</th>
                      <th style={{ whiteSpace: "nowrap" }}>Status</th>
                      <th style={{ whiteSpace: "nowrap" }}>Validity / Purpose</th>
                      <th style={{ whiteSpace: "nowrap" }}>Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx._id}>
                        <td style={{ whiteSpace: "nowrap" }}>{formatDate(tx.createdAt)}</td>

                        <td style={{ whiteSpace: "nowrap", textTransform: "capitalize" }}>
                          {tx.type === "fine" ? (
                            <div>
                              <span
                                className="badge"
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  fontSize: "0.72rem",
                                  padding: "2px 8px",
                                  fontWeight: 700,
                                }}
                              >
                                Late Fine
                              </span>
                              {tx.bookTitle && (
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)", marginTop: 2 }}>
                                  {tx.bookTitle}
                                </div>
                              )}
                            </div>
                          ) : (
                            <strong>{tx.tier} Plan</strong>
                          )}
                        </td>

                        <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>₹{tx.amount}</td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <span
                            className={`badge ${
                              tx.status === "success"
                                ? "badge-success"
                                : tx.status === "failed"
                                ? "badge-danger"
                                : "badge-warning"
                            }`}
                            style={{ textTransform: "capitalize" }}
                          >
                            {tx.status}
                          </span>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          {tx.type === "fine" ? (
                            <span style={{ fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>
                              Fine Settled
                            </span>
                          ) : tx.startDate && tx.endDate ? (
                            <span>
                              {formatDate(tx.startDate)} &rarr; {formatDate(tx.endDate)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem", color: "var(--text-secondary, #666)" }}>
                          {tx.paymentId || tx.orderId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalTxPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 18,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border, #e5e7eb)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
                    Showing {(txPage - 1) * txPerPage + 1} to{" "}
                    {Math.min(txPage * txPerPage, transactions.length)} of {transactions.length} records
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      disabled={txPage === 1}
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, padding: "0 6px" }}>
                      Page {txPage} of {totalTxPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      disabled={txPage >= totalTxPages}
                      onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: SETTINGS (CHANGE PASSWORD)                              */}
      {/* ============================================================== */}
      {activeTab === "settings" && (
        <div style={{ maxWidth: 580 }}>
          <form className="card" onSubmit={savePw} noValidate>
            <h3 style={{ marginTop: 0, fontSize: "1.15rem" }}>Security & Password</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
              Ensure your account is using a secure, long password.
            </p>

            {pwFormError && <div className="alert-error">{pwFormError}</div>}

            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                value={pw.currentPassword}
                onChange={changePw}
                error={pwErrors.currentPassword}
              />
            </div>

            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                value={pw.newPassword}
                onChange={changePw}
                error={pwErrors.newPassword}
              />
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={pw.confirmPassword}
                onChange={changePw}
                error={pwErrors.confirmPassword}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn"
                disabled={savingPw || !pw.currentPassword || !pw.newPassword}
              >
                {savingPw ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showCropper && rawAvatarSrc && (
        <ImageCropModal
          imageSrc={rawAvatarSrc}
          aspectRatio={1}
          onCropComplete={handleCropComplete}
          onClose={() => setShowCropper(false)}
        />
      )}

      {showMembershipModal && (
        <MembershipModal onClose={() => setShowMembershipModal(false)} />
      )}
    </>
  );
}
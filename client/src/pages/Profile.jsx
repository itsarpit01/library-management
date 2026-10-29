import { useEffect, useState, useCallback } from "react";
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

const SERVER_URL = "http://localhost:5000";
const emptyPw = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

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
    // Load profile, active issued books, pending requests, and transactions
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

    // Jab plan upgrade ho, toh transactions bhi auto-refresh hon
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
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
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
      setNameError(parsed.error.issues[0].message);
      return;
    }

    setSavingName(true);
    try {
      let res;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("avatar", avatarFile);
        res = await api.put("/users/profile", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.put("/users/profile", { name: name.trim() });
      }

      setProfile(res.data);
      updateUser(res.data);
      setAvatarFile(null);
      toast.success("Profile updated");
    } catch (err) {
      const fe = getFieldErrors(err);
      if (fe.name) setNameError(fe.name);
      else toast.error(getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const changePw = (e) => {
    const { name: field, value } = e.target;
    setPw((p) => ({ ...p, [field]: value }));
    setPwErrors((pe) => ({ ...pe, [field]: undefined }));
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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Profile</h2>
          <p>Manage your account details and password.</p>
        </div>
      </div>

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

              {/* Status Indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#16a34a", fontWeight: 600, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }}></span>
                <span>Active Account • {tier.tier === "free" ? "Free Lifetime Access" : "Active Subscription"}</span>
              </div>

              {/* Live Borrowing & Request Capacity Meter */}
              <div style={{ background: "rgba(92, 107, 192, 0.05)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
                  <span>Active Capacity</span>
                  <span style={{ color: totalActiveSlots >= tier.maxBooks && tier.maxBooks !== Infinity ? "#dc2626" : "var(--primary, #5c6bc0)" }}>
                    {totalActiveSlots} / {tier.maxBooks === Infinity ? "Unlimited" : `${tier.maxBooks} slots`}
                  </span>
                </div>
                <div style={{ width: "100%", height: 7, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${usagePercentage}%`,
                      background:
                        totalActiveSlots >= tier.maxBooks && tier.maxBooks !== Infinity
                          ? "#ef4444"
                          : "var(--primary, #5c6bc0)",
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-secondary, #666)", marginTop: 6 }}>
                  <span>{activeBooksCount} issued • {activeRequestsCount} pending</span>
                  <strong style={{ color: totalActiveSlots >= tier.maxBooks && tier.maxBooks !== Infinity ? "#dc2626" : "#16a34a" }}>
                    {tier.maxBooks === Infinity
                      ? "Unlimited remaining"
                      : `${remainingSlots} request slot(s) left`}
                  </strong>
                </div>
              </div>

              {/* Key Limits & Validity Range */}
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

              {/* Plan Benefits Checklist */}
              <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem", color: "var(--text-secondary, #666)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16a34a" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Catalog browsing & book searches</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16a34a" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Return & reissue request tracking</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: tier.tier !== "free" ? "#16a34a" : "#9ca3af" }}>
                  {tier.tier !== "free" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                  <span>10 active books capacity (Premium)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: tier.tier === "ultimate" ? "#16a34a" : "#9ca3af" }}>
                  {tier.tier === "ultimate" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                  <span>Unlimited books & upcoming dates (Ultimate)</span>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "auto", paddingTop: 16 }}>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setShowMembershipModal(true)}
                style={{ width: "100%" }}
              >
                View Plans & Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Card 3: Change Password */}
        <form
          className="card"
          onSubmit={savePw}
          noValidate
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div style={{ flex: 1 }}>
            <h3 style={{ marginTop: 0 }}>Change Password</h3>
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
          </div>

          <div className="modal-actions" style={{ marginTop: "auto", paddingTop: 16 }}>
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

      {/* Card 4: Payment & Membership Transaction History */}
      {user.role === "purchaser" && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Payment & Membership History</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary, #666)" }}>
                Track your membership purchases, payment status, and validity ranges.
              </p>
            </div>

            {user.membership?.startedAt && tier.tier !== "free" && (
              <span
                className="badge"
                style={{
                  background: "rgba(99, 102, 241, 0.1)",
                  color: "#4f46e5",
                  fontWeight: 600,
                  padding: "4px 12px",
                }}
              >
                Current Active: {formatDate(user.membership.startedAt)} &rarr; {formatDate(user.membership.expiresAt)}
              </span>
            )}
          </div>

          {loadingTransactions ? (
            <p className="empty">Loading payment history...</p>
          ) : transactions.length === 0 ? (
            <p className="empty">No payment transactions found yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Date</th>
                    <th style={{ whiteSpace: "nowrap" }}>Plan</th>
                    <th style={{ whiteSpace: "nowrap" }}>Amount</th>
                    <th style={{ whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ whiteSpace: "nowrap" }}>Validity Period</th>
                    <th style={{ whiteSpace: "nowrap" }}>Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(tx.createdAt)}</td>
                      <td style={{ whiteSpace: "nowrap", textTransform: "capitalize" }}>
                        <strong>{tx.tier}</strong>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>₹{tx.amount}</td>
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
                        {tx.startDate && tx.endDate ? (
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
          )}
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
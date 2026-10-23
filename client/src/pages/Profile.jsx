
import { useEffect, useState } from "react";
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
  const [activeBooksCount, setActiveBooksCount] = useState(0);

  const [pw, setPw] = useState(emptyPw);
  const [pwErrors, setPwErrors] = useState({});
  const [pwFormError, setPwFormError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const tier = getEffectiveTier(user);

  useEffect(() => {
    // Load profile info and current active issues count
    Promise.all([
      api.get("/users/me"),
      api.get("/issues/my").catch(() => ({ data: [] })),
    ])
      .then(([userRes, issueRes]) => {
        setProfile(userRes.data);
        setName(userRes.data.name);

        const issues = Array.isArray(issueRes.data) ? issueRes.data : [];
        const active = issues.filter((i) => i.status === "issued").length;
        setActiveBooksCount(active);
      })
      .catch((err) => toast.error(getErrorMessage(err)));
  }, [toast]);

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
      const fd = new FormData();
      fd.append("name", parsed.data.name);
      if (avatarFile) fd.append("avatar", avatarFile);

      const { data } = await api.patch("/users/me", fd);
      updateUser({ name: data.user.name, avatar: data.user.avatar });
      setProfile((p) => ({ ...p, name: data.user.name, avatar: data.user.avatar }));
      setName(data.user.name);
      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Profile updated");
    } catch (err) {
      const fe = getFieldErrors(err);
      setNameError(fe.name || getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const changePw = (e) => {
    setPw((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwFormError("");

    const parsed = passwordFormSchema.safeParse(pw);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
      });
      setPwErrors(fe);
      return;
    }

    setSavingPw(true);
    try {
      await api.patch("/users/me/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      toast.success("Password changed");
      setPw(emptyPw);
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length) setPwErrors(fe);
      else setPwFormError(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const avatarSrc = avatarPreview || (profile?.avatar ? `${SERVER_URL}${profile.avatar}` : null);
  const unchanged = name.trim() === (profile?.name ?? user?.name) && !avatarFile;

  // Percentage used for progress bar
  const usagePercentage =
    tier.maxBooks === Infinity
      ? 10
      : Math.min(100, Math.round((activeBooksCount / tier.maxBooks) * 100));

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
                      borderRadius: "50%",
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid white",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </span>
                </div>
                <input
                  id="avatarInput"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  hidden
                />
              </label>
              <div>
                <h3 style={{ margin: 0 }}>{profile?.name || user?.name}</h3>
                <span className="badge" style={{ textTransform: "capitalize" }}>
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="name">Name</label>
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

        {/* Card 2: Rich Comprehensive Membership Card */}
        {user.role === "purchaser" && (
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            <div style={{ flex: 1 }}>
              {/* Header with Title and Tier Badge */}
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

              {/* Live Borrowing Capacity with Progress Bar */}
              <div style={{ background: "rgba(92, 107, 192, 0.05)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", fontWeight: 600, marginBottom: 6 }}>
                  <span>Borrowing Capacity</span>
                  <span style={{ color: activeBooksCount >= tier.maxBooks && tier.maxBooks !== Infinity ? "#dc2626" : "var(--primary, #5c6bc0)" }}>
                    {activeBooksCount} / {tier.maxBooks === Infinity ? "Unlimited" : `${tier.maxBooks} books`}
                  </span>
                </div>
                <div style={{ width: "100%", height: 7, background: "rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${usagePercentage}%`,
                      background:
                        activeBooksCount >= tier.maxBooks && tier.maxBooks !== Infinity
                          ? "#ef4444"
                          : "var(--primary, #5c6bc0)",
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #666)", display: "block", marginTop: 4 }}>
                  {tier.maxBooks === Infinity
                    ? "Unlimited active loans allowed"
                    : `${Math.max(0, tier.maxBooks - activeBooksCount)} borrowing slot(s) available`}
                </span>
              </div>

              {/* Key Limits */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary, #5c6bc0)" }}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span><strong>Reading Window:</strong> Up to {tier.maxIssueDays} days per issue</span>
                </div>
                {user?.membership?.expiresAt && tier.tier !== "free" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#d97706" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span><strong>Subscription Renews:</strong> {formatDate(user.membership.expiresAt)}</span>
                  </div>
                )}
              </div>

              {/* What's Included / Locked Checklist */}
              <div style={{ borderTop: "1px solid var(--border, #eee)", paddingTop: 10, marginBottom: 14 }}>
                <span style={{ fontSize: "0.76rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-secondary, #888)", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>
                  Plan Privileges
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success, #16a34a)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Standard library catalog access</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success, #16a34a)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Self-return & reissue request workflow</span>
                  </div>
                  {tier.tier === "free" ? (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Priority approval queue (Premium)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>60-day reading duration (Ultimate)</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success, #16a34a)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Priority review & extended limits enabled</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upgrade Promo Callout (for Free users) */}
              {tier.tier === "free" && (
                <div style={{ background: "rgba(124, 58, 237, 0.06)", border: "1px dashed #c4b5fd", borderRadius: 8, padding: "8px 10px", fontSize: "0.78rem", color: "#6d28d9" }}>
                  Need more capacity? Upgrade to <strong>Premium</strong> for 10 books or <strong>Ultimate</strong> for unlimited reading.
                </div>
              )}
            </div>

            {/* Bottom Pinned Upgrade Button */}
            <div className="modal-actions" style={{ marginTop: "auto", paddingTop: 16 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowMembershipModal(true)}
                style={{
                  width: "100%",
                  background:
                    tier.tier === "free"
                      ? "linear-gradient(135deg, #7c3aed, #5b21b6)"
                      : "var(--primary, #5c6bc0)",
                  color: "#fff",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{tier.tier === "free" ? "Upgrade Membership" : "Change / Extend Plan"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Card 3: Password Change Form */}
        <form
          className="card"
          onSubmit={savePassword}
          noValidate
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div style={{ flex: 1 }}>
            <h3>Change password</h3>
            {pwFormError && <div className="alert-error">{pwFormError}</div>}

            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                value={pw.currentPassword}
                onChange={changePw}
              />
              {pwErrors.currentPassword && (
                <span className="error-text">{pwErrors.currentPassword}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                value={pw.newPassword}
                onChange={changePw}
              />
              {pwErrors.newPassword ? (
                <span className="error-text">{pwErrors.newPassword}</span>
              ) : (
                <span className="hint">
                  Min 8 characters with capital, small letter, number and special character.
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={pw.confirmPassword}
                onChange={changePw}
              />
              {pwErrors.confirmPassword && (
                <span className="error-text">{pwErrors.confirmPassword}</span>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: "auto", paddingTop: 16 }}>
            <button type="submit" className="btn" disabled={savingPw}>
              {savingPw ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>

      {showCropper && rawAvatarSrc && (
        <ImageCropModal
          imageSrc={rawAvatarSrc}
          aspect={1}
          title="Crop & Rotate Profile Avatar"
          onClose={() => setShowCropper(false)}
          onComplete={handleCropComplete}
        />
      )}

      {showMembershipModal && (
        <MembershipModal onClose={() => setShowMembershipModal(false)} />
      )}
    </>
  );
}

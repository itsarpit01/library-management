import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";
import { profileSchema, passwordFormSchema } from "../schemas/profileSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate } from "../utils/format";

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

  const [pw, setPw] = useState(emptyPw);
  const [pwErrors, setPwErrors] = useState({});
  const [pwFormError, setPwFormError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api
      .get("/users/me")
      .then((res) => {
        setProfile(res.data);
        setName(res.data.name);
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
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be under 2MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My Profile</h2>
          <p>Manage your account details and password.</p>
        </div>
      </div>

      <div className="profile-grid">
        <form className="card" onSubmit={saveName} noValidate>
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

          <div className="modal-actions">
            <button type="submit" className="btn" disabled={savingName || unchanged}>
              {savingName ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>

        <form className="card" onSubmit={savePassword} noValidate>
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

          <div className="modal-actions">
            <button type="submit" className="btn" disabled={savingPw}>
              {savingPw ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
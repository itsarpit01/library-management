import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";
import { profileSchema, passwordFormSchema } from "../schemas/profileSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { formatDate } from "../utils/format";

const emptyPw = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

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
      const { data } = await api.patch("/users/me", parsed.data);
      updateUser({ name: data.user.name });
      setProfile((p) => ({ ...p, name: data.user.name }));
      setName(data.user.name);
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

  const unchanged = name.trim() === (profile?.name ?? user?.name);

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
            <span className="avatar avatar-lg">{user?.name?.[0]?.toUpperCase()}</span>
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
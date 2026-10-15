import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";
import { emailStepSchema, resetFormSchema } from "../schemas/forgotSchema";
import { getErrorMessage, getFieldErrors } from "../utils/errors";

const firstErrors = (issues) => {
  const fe = {};
  issues.forEach((i) => {
    if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
  });
  return fe;
};

export default function ForgotPassword() {
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ otp: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async (e) => {
    e?.preventDefault();
    setError("");

    const parsed = emailStepSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", parsed.data);
      setEmail(parsed.data.email);
      setStep(2);
      setCooldown(60);
      toast.success("If the email is registered, an OTP has been sent");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError("");

    const parsed = resetFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(firstErrors(parsed.error.issues));
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        otp: parsed.data.otp,
        newPassword: parsed.data.newPassword,
      });
      toast.success("Password reset. Please login.");
      navigate("/login", { replace: true });
    } catch (err) {
      const fe = getFieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {step === 1 ? (
        <form onSubmit={sendOtp} noValidate>
          <h2>Forgot password</h2>
          <p className="sub">Enter your email and we will send you a 6-digit code.</p>

          {error && <div className="alert-error">{error}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({});
              }}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>

          <p className="switch">
            Remembered it? <Link to="/login">Back to login</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={resetPassword} noValidate>
          <h2>Reset password</h2>
          <p className="sub">
            Enter the 6-digit code sent to <strong>{email}</strong>. It expires in 10 minutes.
          </p>

          {error && <div className="alert-error">{error}</div>}

          <div className="field">
            <label htmlFor="otp">OTP</label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={form.otp}
              onChange={(e) => change({ target: { name: "otp", value: e.target.value.replace(/\D/g, "") } })}
            />
            {errors.otp && <span className="error-text">{errors.otp}</span>}
          </div>

          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              value={form.newPassword}
              onChange={change}
            />
            {errors.newPassword ? (
              <span className="error-text">{errors.newPassword}</span>
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
              value={form.confirmPassword}
              onChange={change}
            />
            {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
          </div>

          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </button>

          <p className="switch">
            {cooldown > 0 ? (
              <>Resend OTP in {cooldown}s</>
            ) : (
              <button type="button" className="link-btn" onClick={sendOtp} disabled={loading}>
                Resend OTP
              </button>
            )}
            {" · "}
            <button type="button" className="link-btn" onClick={() => { setStep(1); setError(""); setErrors({}); }}>
              Change email
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
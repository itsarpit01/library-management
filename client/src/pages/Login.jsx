import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";

const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors((er) => ({ ...er, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const parsed = loginFormSchema.safeParse(form);
    if (!parsed.success) {
      const fe = {};
      parsed.error.issues.forEach((i) => {
        if (!fe[i.path[0]]) fe[i.path[0]] = i.message;
      });
      setErrors(fe);
      return;
    }

    setLoading(true);
    try {
      const user = await login(parsed.data.email, parsed.data.password);
      toast.success(`Welcome back, ${user.name}`);
      navigate(user.role === "librarian" ? "/librarian" : "/purchaser", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} noValidate>
        <h2>Welcome back</h2>
        <p className="sub">Login to continue to LibraryHub.</p>

        {error && <div className="alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Your password"
            value={form.password}
            onChange={handleChange}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>

        <p style={{ textAlign: "right", marginTop: -6, marginBottom: 14, fontSize: 14 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>

        <button className="btn btn-block" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="switch">
          New here? <Link to="/register">Create account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
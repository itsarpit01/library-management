import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const field = { display: "block", width: "100%", marginBottom: 8 };

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "purchaser",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.role);
      navigate("/login", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const first = Array.isArray(data?.errors)
        ? data.errors[0]
        : data?.errors && Object.values(data.errors)[0];

      const message =
        typeof first === "string"
          ? first
          : first?.message || data?.message || "Registration failed";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 360, margin: "60px auto" }}>
      <h2>Create account</h2>
      <input name="name" placeholder="Name" value={form.name}
        onChange={handleChange} style={field} />
      <input name="email" type="email" placeholder="Email" value={form.email}
        onChange={handleChange} style={field} />
      <input name="password" type="password" placeholder="Password"
        value={form.password} onChange={handleChange} style={field} />
      <small style={{ color: "#6b7280" }}>
        Min 8 characters, capital, small letter, number aur special character zaroori.
      </small>
      <select name="role" value={form.role} onChange={handleChange}
        style={{ ...field, marginTop: 8 }}>
        <option value="purchaser">Purchaser</option>
        <option value="librarian">Librarian</option>
      </select>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create account"}
      </button>
      <p style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </form>
  );
}
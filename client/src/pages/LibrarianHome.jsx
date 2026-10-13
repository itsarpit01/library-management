import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function LibrarianHome() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Librarian: {user.name}</h2>
      <button onClick={logout}>Logout</button>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
}
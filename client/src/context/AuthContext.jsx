import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const VALID_ROLES = ["librarian", "purchaser"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // App khulte hi: cookie valid hai to user mil jata hai
  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, role = "purchaser") => {
    const { data } = await api.post("/auth/register", { name, email, password, role });
    return data;
  };

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // server na mile tab bhi local state saaf
    }
    setUser(null);
  }, []);

  useEffect(() => {
    const onForcedLogout = () => setUser(null);
    window.addEventListener("auth:logout", onForcedLogout);
    return () => window.removeEventListener("auth:logout", onForcedLogout);
  }, []);

  const isAuthenticated = !!user && VALID_ROLES.includes(user.role);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, isAuthenticated, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
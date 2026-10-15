import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="empty">Loading...</p>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const home = user.role === "librarian" ? "/librarian" : "/purchaser";
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
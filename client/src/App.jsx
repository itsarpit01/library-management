import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LibrarianHome from "./pages/LibrarianHome";
import PurchaserHome from "./pages/PurchaserHome";

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={user.role === "librarian" ? "/librarian" : "/purchaser"}
      replace
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Librarian group */}
      <Route element={<ProtectedRoute roles={["librarian"]} />}>
        <Route path="/librarian" element={<LibrarianHome />} />
      </Route>

      {/* Purchaser group */}
      <Route element={<ProtectedRoute roles={["purchaser"]} />}>
        <Route path="/purchaser" element={<PurchaserHome />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
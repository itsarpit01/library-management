import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import LibrarianHome from "./pages/LibrarianHome";
import LibrarianBooks from "./pages/LibrarianBooks";
import LibrarianIssues from "./pages/LibrarianIssues";
import LibrarianRequests from "./pages/LibrarianRequests";
import PurchaserHome from "./pages/PurchaserHome";
import PurchaserBooks from "./pages/PurchaserBooks";
import PurchaserIssues from "./pages/PurchaserIssues";
import PurchaserRequests from "./pages/PurchaserRequests";

function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return null; // session check hone tak ruko
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
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Librarian group */}
      <Route element={<ProtectedRoute roles={["librarian"]} />}>
        <Route path="/librarian" element={<AppLayout />}>
          <Route index element={<LibrarianHome />} />
          <Route path="books" element={<LibrarianBooks />} />
          <Route path="issues" element={<LibrarianIssues />} />
          <Route path="requests" element={<LibrarianRequests />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Purchaser group */}
      <Route element={<ProtectedRoute roles={["purchaser"]} />}>
        <Route path="/purchaser" element={<AppLayout />}>
          <Route index element={<PurchaserHome />} />
          <Route path="books" element={<PurchaserBooks />} />
          <Route path="my-issues" element={<PurchaserIssues />} />
          <Route path="requests" element={<PurchaserRequests />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
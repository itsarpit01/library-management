import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LibrarianHome from "./pages/LibrarianHome";
import PurchaserHome from "./pages/PurchaserHome";
import ComingSoon from "./pages/ComingSoon";
import LibrarianBooks from "./pages/LibrarianBooks";
import LibrarianIssues from "./pages/LibrarianIssues";
import LibrarianRequests from "./pages/LibrarianRequests";
import PurchaserRequests from "./pages/PurchaserRequests";

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
        <Route path="/librarian" element={<AppLayout />}>
          <Route index element={<LibrarianHome />} />
          <Route path="books" element={<LibrarianBooks />} />
          <Route path="issues" element={<LibrarianIssues />} />
          <Route path="requests" element={<LibrarianRequests />} />
        </Route>
      </Route>

      {/* Purchaser group */}
      <Route element={<ProtectedRoute roles={["purchaser"]} />}>
        <Route path="/purchaser" element={<AppLayout />}>
          <Route index element={<PurchaserHome />} />
          <Route path="books" element={<ComingSoon title="Browse Books" />} />
          <Route path="my-issues" element={<ComingSoon title="My Issues" />} />
          <Route path="requests" element={<PurchaserRequests />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
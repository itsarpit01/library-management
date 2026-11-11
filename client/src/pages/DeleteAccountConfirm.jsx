import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";

export default function DeleteAccountConfirm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No deletion token provided in URL. Please check the link from your email.");
      setLoading(false);
      return;
    }

    api
      .get(`/users/verify-delete-token/${token}`)
      .then((res) => {
        setUserData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(getErrorMessage(err));
        setLoading(false);
      });
  }, [token]);

  const handleConfirmDelete = async () => {
    if (!token || verifying) return;
    setVerifying(true);

    try {
      const res = await api.post("/users/confirm-account-deletion", { token });
      setDeleted(true);
      toast.success(res.data.message || "Account permanently deleted.");
      if (logout) logout();
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setVerifying(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "var(--bg, #f8fafc)",
      }}
    >
      <div
        style={{
          maxWidth: 540,
          width: "100%",
          background: "var(--surface, #ffffff)",
          borderRadius: 14,
          padding: 32,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--border, #e5e7eb)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: deleted ? "#ecfdf5" : error ? "#fef2f2" : "#fee2e2",
              color: deleted ? "#059669" : "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
            }}
          >
            {deleted ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            )}
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.45rem", color: "var(--text, #111)" }}>
            {deleted
              ? "Account Deleted"
              : error
              ? "Link Expired or Invalid"
              : "Confirm Account Deletion"}
          </h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary, #666)" }}>
            {deleted
              ? "Your account and data have been permanently removed."
              : error
              ? "We could not verify this deletion request."
              : "Review terms before permanently closing your account."}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-secondary, #666)" }}>
            Verifying deletion token...
          </div>
        ) : deleted ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.92rem", color: "var(--text, #333)", margin: "0 0 20px 0" }}>
              All records, subscriptions, and personal information have been erased. Redirecting to login page...
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/login")}
            >
              Go to Login
            </button>
          </div>
        ) : error ? (
          <div>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "14px 16px",
                color: "#991b1b",
                fontSize: "0.9rem",
                marginBottom: 20,
              }}
            >
              {error}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => navigate("/")}
              >
                Back to Safety
              </button>
            </div>
          </div>
        ) : userData ? (
          <div>
            {/* Account Details Box */}
            <div
              style={{
                background: "var(--soft-1, #f9fafb)",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 18,
                fontSize: "0.86rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary, #666)" }}>Name:</span>
                <strong>{userData.user.name}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary, #666)" }}>Email:</span>
                <strong>{userData.user.email}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary, #666)" }}>Member ID:</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{userData.user.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary, #666)" }}>Membership:</span>
                <strong style={{ textTransform: "capitalize" }}>{userData.user.membership}</strong>
              </div>
            </div>

            {/* Terms of Deletion */}
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 24,
              }}
            >
              <div style={{ fontWeight: 700, color: "#991b1b", fontSize: "0.9rem", marginBottom: 6 }}>
                Permanent Action Warning
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.84rem", color: "#b91c1c", lineHeight: 1.5 }}>
                <li>Your profile credentials and personal details will be erased permanently.</li>
                <li>Your membership plan and capacity limits will be terminated.</li>
                <li>All transaction history, payment receipts, and issue records will be removed.</li>
                <li>You will immediately be logged out from all devices.</li>
              </ul>
            </div>

            {/* Pre-flight Checks */}
            <div style={{ marginBottom: 24, fontSize: "0.84rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, color: userData.activeBooks === 0 ? "#16a34a" : "#dc2626" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {userData.activeBooks === 0 ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                </svg>
                <span>Borrowed Books Checked In: {userData.activeBooks === 0 ? "0 active (Cleared)" : `${userData.activeBooks} unreturned`}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: userData.totalUnpaidFines === 0 ? "#16a34a" : "#dc2626" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {userData.totalUnpaidFines === 0 ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                </svg>
                <span>Outstanding Fine Dues: {userData.totalUnpaidFines === 0 ? "₹0 (Cleared)" : `₹${userData.totalUnpaidFines} Due`}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="btn btn-soft"
                disabled={verifying}
                onClick={() => navigate("/")}
              >
                Cancel & Keep Account
              </button>
              <button
                type="button"
                className="btn"
                disabled={verifying || userData.hasBlockers}
                onClick={handleConfirmDelete}
                style={{
                  background: "#dc2626",
                  borderColor: "#dc2626",
                  color: "#ffffff",
                  opacity: verifying || userData.hasBlockers ? 0.6 : 1,
                  cursor: verifying || userData.hasBlockers ? "not-allowed" : "pointer",
                }}
              >
                {verifying ? "Deleting Account..." : "Permanently Delete My Account"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
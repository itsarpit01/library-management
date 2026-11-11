import { useEffect, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errors";

export default function DeleteAccountModal({ onClose }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [eligibility, setEligibility] = useState({
    canDelete: false,
    activeIssuesCount: 0,
    unpaidFinesCount: 0,
    totalUnpaidFines: 0,
  });

  useEffect(() => {
    let mounted = true;
    api
      .get("/users/deletion-eligibility")
      .then((res) => {
        if (mounted) {
          setEligibility(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          toast.error(getErrorMessage(err));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [toast]);

  const hasBlockers =
    eligibility.activeIssuesCount > 0 || eligibility.totalUnpaidFines > 0;

  const handleDisabledClick = () => {
    if (hasBlockers) {
      if (eligibility.activeIssuesCount > 0 && eligibility.totalUnpaidFines > 0) {
        toast.error(
          `Please return your ${eligibility.activeIssuesCount} borrowed book(s) and pay your ₹${eligibility.totalUnpaidFines} fine first.`
        );
      } else if (eligibility.activeIssuesCount > 0) {
        toast.error(
          `Please return your ${eligibility.activeIssuesCount} borrowed book(s) before deleting your account.`
        );
      } else {
        toast.error(
          `Please settle your outstanding late fine of ₹${eligibility.totalUnpaidFines} under My Issues first.`
        );
      }
    } else if (!acknowledged) {
      toast.error("Please tick the confirmation checkbox to proceed.");
    }
  };

  const handleSendLink = async () => {
    if (hasBlockers || !acknowledged || submitting) return;

    setSubmitting(true);
    try {
      const res = await api.post("/users/request-account-deletion");
      toast.success(
        res.data.message ||
          "Verification link sent to your registered email address. Please check your inbox."
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="modal-card"
        style={{
          background: "var(--surface, #ffffff)",
          borderRadius: 14,
          padding: 24,
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
          border: "1px solid var(--border, #e5e7eb)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text, #111)" }}>
              Delete Account
            </h3>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary, #666)" }}>
              Permanent deletion with email verification
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-secondary, #666)" }}>
            Checking account eligibility...
          </div>
        ) : hasBlockers ? (
          <div>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 700, color: "#991b1b", fontSize: "0.9rem", marginBottom: 6 }}>
                Account Deletion Blocked
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.84rem", color: "#b91c1c", lineHeight: 1.5 }}>
                {eligibility.activeIssuesCount > 0 && (
                  <li>
                    You currently have <strong>{eligibility.activeIssuesCount}</strong> borrowed book(s). Return all books first.
                  </li>
                )}
                {eligibility.totalUnpaidFines > 0 && (
                  <li>
                    You have an outstanding late fine of <strong>₹{eligibility.totalUnpaidFines}</strong>. Settle your fine under My Issues.
                  </li>
                )}
              </ul>
            </div>

            <p style={{ fontSize: "0.84rem", color: "var(--text-secondary, #666)", margin: "0 0 20px 0" }}>
              Library policies require all loaned books to be checked in and all dues settled before an account can be closed.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn btn-soft"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDisabledClick}
                style={{
                  background: "#f87171",
                  borderColor: "#f87171",
                  color: "#fff",
                  opacity: 0.65,
                  cursor: "not-allowed",
                }}
              >
                Send Deletion Link
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "0.88rem", color: "var(--text, #333)", lineHeight: 1.5, margin: "0 0 14px 0" }}>
              To permanently close your LibraryHub account, we will send a secure verification link to{" "}
              <strong>your registered email address</strong>.
            </p>

            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #ffedd5",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 16,
                fontSize: "0.82rem",
                color: "#9a3412",
              }}
            >
              <strong>Notice:</strong> All profile records, membership benefits, borrowing history, and transaction logs will be permanently deleted.
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: "0.84rem",
                color: "var(--text, #333)",
                cursor: "pointer",
                marginBottom: 20,
                lineHeight: 1.4,
              }}
            >
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ marginTop: 2, cursor: "pointer" }}
              />
              <span>
                I understand that deleting my account is permanent and cannot be undone. Send a confirmation email to verify.
              </span>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="btn btn-soft"
                disabled={submitting}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={!acknowledged || submitting}
                onClick={!acknowledged ? handleDisabledClick : handleSendLink}
                style={{
                  background: acknowledged ? "#dc2626" : "#f87171",
                  borderColor: acknowledged ? "#dc2626" : "#f87171",
                  color: "#ffffff",
                  opacity: acknowledged && !submitting ? 1 : 0.6,
                  cursor: acknowledged && !submitting ? "pointer" : "not-allowed",
                }}
              >
                {submitting ? "Sending Link..." : "Send Deletion Link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
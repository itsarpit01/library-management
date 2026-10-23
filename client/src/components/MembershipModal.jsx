import api from "../api/axios";
import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { MEMBERSHIP_TIERS, getEffectiveTier } from "../utils/membershipConfig";
import { formatDate } from "../utils/format";

export default function MembershipModal({ onClose }) {
  const { user } = useAuth();
  const toast = useToast();

  const currentTier = getEffectiveTier(user);

  // Locked until Payment Gateway is integrated in 2-3 days
  const handleUpgrade = (tierName) => {
    toast.info(`Payment gateway integration in progress! ${tierName} plan will be available for purchase in a few days.`);
  };

  return (
    <Modal title="Membership Plans" onClose={onClose} maxWidth="860px">
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <p style={{ margin: 0, color: "var(--text-secondary, #666)" }}>
          Choose a plan that fits your reading habits.
        </p>
        {user?.membership?.expiresAt && currentTier.tier !== "free" && (
          <span
            className="badge"
            style={{
              marginTop: 8,
              display: "inline-block",
              background: "rgba(99, 102, 241, 0.1)",
              color: "#4f46e5",
              fontWeight: 600,
              padding: "4px 12px",
            }}
          >
            Current plan expires on: {formatDate(user.membership.expiresAt)}
          </span>
        )}
      </div>

      {/* Horizontal 3-Column Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {Object.values(MEMBERSHIP_TIERS).map((plan) => {
          const isCurrent = currentTier.tier === plan.tier;

          return (
            <div
              key={plan.tier}
              style={{
                border: isCurrent
                  ? `2px solid ${plan.color}`
                  : "1px solid var(--border, #e0e0e0)",
                borderRadius: 12,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                background: isCurrent ? "rgba(99, 102, 241, 0.04)" : "var(--card-bg, #fff)",
                boxShadow: isCurrent ? "0 4px 14px rgba(99, 102, 241, 0.12)" : "none",
              }}
            >
              {isCurrent && (
                <span
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 12,
                    background: plan.color,
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 10,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                >
                  Active Plan
                </span>
              )}

              <h3 style={{ margin: "2px 0 6px 0", color: plan.color, fontSize: "1.15rem" }}>
                {plan.name}
              </h3>

              <div style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "4px 0 12px 0" }}>
                {plan.price === 0 ? "Free" : `₹${plan.price}`}
                {plan.durationMonths && (
                  <span style={{ fontSize: "0.82rem", color: "#888", fontWeight: "normal" }}>
                    {" "}
                    / {plan.durationMonths} mos
                  </span>
                )}
              </div>

              {/* Perks List */}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", flex: 1, fontSize: "0.85rem" }}>
                {plan.perks.map((perk, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, lineHeight: 1.35 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success, #16a34a)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              {isCurrent ? (
                <button
                  className="btn btn-soft"
                  disabled
                  style={{ width: "100%", fontWeight: 600, opacity: 0.8 }}
                >
                  Current Plan
                </button>
              ) : plan.tier === "free" ? (
                <button
                  className="btn btn-soft"
                  disabled
                  style={{ width: "100%", fontWeight: 600, opacity: 0.6 }}
                >
                  Standard Plan
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={() => handleUpgrade(plan.name)}
                  style={{
                    width: "100%",
                    background:
                      plan.tier === "ultimate"
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : "var(--primary, #5c6bc0)",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                >
                  Upgrade (Coming Soon)
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
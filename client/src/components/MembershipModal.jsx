import { useState } from "react";
import api from "../api/axios";
import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { MEMBERSHIP_TIERS, getEffectiveTier } from "../utils/membershipConfig";
import { formatDate } from "../utils/format";
import { getErrorMessage } from "../utils/errors";

export default function MembershipModal({ onClose }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [processingTier, setProcessingTier] = useState(null);

  const currentTier = getEffectiveTier(user);

  /**
   * Model B: Calculate Prorated Upgrade Details for Active Premium Users
   */
  const getProratedUpgradeInfo = (targetTier) => {
    if (targetTier !== "ultimate" || currentTier.tier !== "premium") {
      return null;
    }

    const expiresAt = user?.membership?.expiresAt;
    if (!expiresAt) return null;

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    if (expiryTime <= now) return null;

    // Total validity of Premium plan = 180 days (6 months)
    const totalDays = 6 * 30;
    const remainingMs = expiryTime - now;
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    // Ratio of unused time
    const unusedRatio = Math.min(1, Math.max(0, remainingDays / totalDays));
    const credit = Math.round(499 * unusedRatio);
    const payableAmount = Math.max(1, 999 - credit);

    return {
      originalPrice: 999,
      payableAmount,
      credit,
      remainingDays,
    };
  };

  const handleUpgrade = async (plan) => {
    if (!window.Razorpay) {
      toast.error("Razorpay SDK failed to load. Please refresh the page and try again.");
      return;
    }

    setProcessingTier(plan.tier);

    try {
      // 1. Create order on backend (Backend automatically applies Model B prorated deduction)
      const res = await api.post("/payment/create-order", { tier: plan.tier });
      const { orderId, amount, currency, keyId } = res.data;

      // Real-time signal: History me pending show ho sake
      window.dispatchEvent(new Event("quota-updated"));

      // 2. Open Razorpay Checkout modal
      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency: currency || "INR",
        name: "Library Management",
        description: `${plan.name} Membership Plan (${plan.durationMonths} Months)`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: plan.tier === "ultimate" ? "#f59e0b" : "#5b3df5",
        },
        handler: async function (response) {
          try {
            // 3. Verify signature on backend
            const verifyRes = await api.post("/payment/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tier: plan.tier,
            });

            toast.success(verifyRes.data.message || `Upgraded to ${plan.name} successfully!`);

            await refreshUser();
            window.dispatchEvent(new Event("quota-updated"));

            onClose();
          } catch (err) {
            toast.error(getErrorMessage(err));
          } finally {
            setProcessingTier(null);
          }
        },
        modal: {
          ondismiss: async function () {
            try {
              await api.post("/payment/mark-failed", {
                orderId: orderId,
                reason: "Payment cancelled by user (closed checkout popup)",
              });
            } catch {
              // ignore
            }

            window.dispatchEvent(new Event("quota-updated"));
            setProcessingTier(null);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on("payment.failed", async function (response) {
        toast.error(`Payment failed: ${response.error?.description || "Something went wrong"}`);

        try {
          await api.post("/payment/mark-failed", {
            orderId: orderId,
            reason: response.error?.description || "Bank declined transaction",
          });
        } catch {
          // ignore
        }

        window.dispatchEvent(new Event("quota-updated"));
        setProcessingTier(null);
      });

      razorpayInstance.open();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setProcessingTier(null);
    }
  };

  // Helper icons (Clean SVG, No Emojis)
  const renderPlanIcon = (tier) => {
    if (tier === "ultimate") {
      return (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3))",
            color: "#d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      );
    }
    if (tier === "premium") {
      return (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "rgba(99, 102, 241, 0.15)",
            color: "#4f46e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
      );
    }
    return (
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "var(--border, #e5e7eb)",
          color: "var(--text-secondary, #6b7280)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
    );
  };

  const getPlanSubtitle = (tier) => {
    if (tier === "ultimate") return "For power readers with zero limits";
    if (tier === "premium") return "For active readers & fast approvals";
    return "Basic reading access for all members";
  };

  return (
    <Modal title="Membership Plans" onClose={onClose} maxWidth="900px">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ margin: 0, color: "var(--text-secondary, #666)", fontSize: "0.95rem" }}>
          Choose a plan that fits your reading habits. Upgrade or renew anytime.
        </p>

        {user?.membership?.expiresAt && currentTier.tier !== "free" && (
          <div
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              color: "#4f46e5",
              fontWeight: 600,
              fontSize: "0.82rem",
              padding: "5px 14px",
              borderRadius: 20,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Current plan expires on: {formatDate(user.membership.expiresAt)}</span>
          </div>
        )}
      </div>

      {/* Modern 3-Column Plan Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        {Object.values(MEMBERSHIP_TIERS).map((plan) => {
          const isCurrent = currentTier.tier === plan.tier;
          const isProcessing = processingTier === plan.tier;
          const proratedInfo = getProratedUpgradeInfo(plan.tier);
          const isUltimate = plan.tier === "ultimate";
          const isPremium = plan.tier === "premium";

          // Card accent styles
          let cardBorder = "1px solid var(--border, #e5e7eb)";
          let cardBg = "var(--surface, #ffffff)";
          let cardShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";

          if (isCurrent) {
            cardBorder = isUltimate
              ? "2px solid #f59e0b"
              : isPremium
              ? "2px solid #6366f1"
              : "2px solid var(--border, #9ca3af)";
            cardBg = isUltimate
              ? "linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, var(--surface, #ffffff) 100%)"
              : isPremium
              ? "linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, var(--surface, #ffffff) 100%)"
              : "var(--surface, #ffffff)";
            cardShadow = isUltimate
              ? "0 10px 25px -5px rgba(245, 158, 11, 0.22), 0 8px 10px -6px rgba(245, 158, 11, 0.15)"
              : "0 10px 25px -5px rgba(99, 102, 241, 0.2), 0 8px 10px -6px rgba(99, 102, 241, 0.12)";
          } else if (isUltimate) {
            cardBorder = "1px solid rgba(245, 158, 11, 0.4)";
            cardBg = "linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, var(--surface, #ffffff) 100%)";
            cardShadow = "0 6px 18px rgba(245, 158, 11, 0.1)";
          } else if (isPremium) {
            cardBorder = "1px solid rgba(99, 102, 241, 0.3)";
            cardBg = "linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, var(--surface, #ffffff) 100%)";
          }

          return (
            <div
              key={plan.tier}
              style={{
                border: cardBorder,
                borderRadius: 16,
                padding: "22px 18px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                background: cardBg,
                boxShadow: cardShadow,
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
              }}
            >
              {/* Top Banner Tag */}
              {isCurrent ? (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 14,
                    background: isUltimate
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : isPremium
                      ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                      : "var(--text-secondary, #6b7280)",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    padding: "3px 10px",
                    borderRadius: 12,
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
                    textTransform: "uppercase",
                  }}
                >
                  Active Plan
                </span>
              ) : isUltimate ? (
                <span
                  style={{
                    position: "absolute",
                    top: -11,
                    right: 14,
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#ffffff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                    padding: "3px 10px",
                    borderRadius: 12,
                    boxShadow: "0 2px 6px rgba(245, 158, 11, 0.3)",
                    textTransform: "uppercase",
                  }}
                >
                  Best Value
                </span>
              ) : null}

              {/* Header: Icon + Title + Subtitle */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                {renderPlanIcon(plan.tier)}
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: isUltimate ? "#d97706" : isPremium ? "#4f46e5" : "var(--text, #111)",
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }}
                  >
                    {plan.name}
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
                    {getPlanSubtitle(plan.tier)}
                  </div>
                </div>
              </div>

              {/* Price Block */}
              <div
                style={{
                  padding: "12px 0 14px 0",
                  borderBottom: "1px dashed var(--border, #e5e7eb)",
                  marginBottom: 16,
                }}
              >
                {proratedInfo ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: "1.85rem", fontWeight: 800, color: "#d97706", lineHeight: 1 }}>
                        ₹{proratedInfo.payableAmount}
                      </span>
                      <span
                        style={{
                          textDecoration: "line-through",
                          color: "var(--text-secondary, #9ca3af)",
                          fontSize: "1rem",
                          fontWeight: 500,
                        }}
                      >
                        ₹{proratedInfo.originalPrice}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary, #6b7280)", fontWeight: 500 }}>
                        / 12 mos
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#15803d",
                        background: "rgba(22, 163, 74, 0.08)",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontWeight: 600,
                        marginTop: 6,
                        lineHeight: 1.3,
                        display: "inline-block",
                      }}
                    >
                      ₹{proratedInfo.credit} credit applied ({proratedInfo.remainingDays} days unused)
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span
                      style={{
                        fontSize: "1.85rem",
                        fontWeight: 800,
                        color: isUltimate ? "#d97706" : isPremium ? "#4f46e5" : "var(--text, #111)",
                        lineHeight: 1,
                      }}
                    >
                      {plan.price === 0 ? "Free" : `₹${plan.price}`}
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary, #6b7280)", fontWeight: 500 }}>
                      {plan.durationMonths ? `/ ${plan.durationMonths} mos` : "/ forever"}
                    </span>
                  </div>
                )}
              </div>

              {/* Perks List */}
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 20px 0",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {plan.perks.map((perk, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 9,
                      fontSize: "0.84rem",
                      lineHeight: 1.35,
                      color: "var(--text, #374151)",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "rgba(22, 163, 74, 0.12)",
                        color: "#16a34a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {/* Action Buttons */}
              <div style={{ marginTop: "auto" }}>
                {isCurrent ? (
                  <button
                    className="btn btn-soft"
                    disabled
                    style={{
                      width: "100%",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      padding: "10px 14px",
                      background: isUltimate
                        ? "rgba(245, 158, 11, 0.12)"
                        : isPremium
                        ? "rgba(99, 102, 241, 0.1)"
                        : "var(--soft, #f3f4f6)",
                      color: isUltimate ? "#b45309" : isPremium ? "#4338ca" : "var(--muted, #6b7280)",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Current Plan
                  </button>
                ) : plan.tier === "free" ? (
                  <button
                    className="btn btn-soft"
                    disabled
                    style={{
                      width: "100%",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      padding: "10px 14px",
                      opacity: 0.65,
                      background: "var(--border, #f3f4f6)",
                      color: "var(--text-secondary, #6b7280)",
                      border: "none",
                    }}
                  >
                    Standard Plan
                  </button>
                ) : currentTier.tier === "ultimate" ? (
                  <button
                    className="btn btn-soft"
                    disabled
                    style={{
                      width: "100%",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      padding: "10px 14px",
                      opacity: 0.65,
                      background: "var(--border, #f3f4f6)",
                      color: "var(--text-secondary, #6b7280)",
                      border: "none",
                    }}
                  >
                    Included in Ultimate
                  </button>
                ) : (
                  <button
                    className="btn"
                    onClick={() => handleUpgrade(plan)}
                    disabled={isProcessing}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      background: isUltimate
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : "linear-gradient(135deg, #6366f1, #4f46e5)",
                      color: "#ffffff",
                      boxShadow: isUltimate
                        ? "0 4px 12px rgba(245, 158, 11, 0.35)"
                        : "0 4px 12px rgba(99, 102, 241, 0.3)",
                      border: "none",
                      cursor: "pointer",
                      transition: "transform 0.15s ease, filter 0.15s ease",
                    }}
                  >
                    {isProcessing
                      ? "Opening Checkout..."
                      : proratedInfo
                      ? `Pay ₹${proratedInfo.payableAmount} & Upgrade`
                      : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
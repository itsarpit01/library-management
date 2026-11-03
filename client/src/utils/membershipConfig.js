export const MEMBERSHIP_TIERS = {
  free: {
    tier: "free",
    name: "Free",
    badge: "Free",
    color: "#757575",
    maxBooks: 3,
    maxIssueDays: 14, // 2 weeks
    durationMonths: null,
    price: 0,
    perks: [
      "Borrow up to 3 active books",
      "Keep books for up to 14 days (2 weeks)",
      "Standard support",
    ],
  },
  premium: {
    tier: "premium",
    name: "Premium",
    badge: "Premium",
    color: "#5c6bc0",
    maxBooks: 10,
    maxIssueDays: 30, // 1 month
    durationMonths: 6,
    price: 499,
    perks: [
      "Borrow up to 10 active books",
      "Keep books for up to 30 days (1 month)",
      "Priority request review",
      "Valid for 6 Months",
    ],
  },
  ultimate: {
    tier: "ultimate",
    name: "Ultimate",
    badge: "Ultimate",
    color: "#f59e0b",
    maxBooks: Infinity,
    maxIssueDays: 60, // 2 months
    durationMonths: 12,
    price: 999,
    perks: [
      "Unlimited active books",
      "Keep books for up to 60 days (2 months)",
      "Top priority review & instant approval",
      "Valid for 1 Full Year",
    ],
  },
};

export const getEffectiveTier = (user) => {
  const mem = user?.membership;
  if (!mem || !mem.tier) return MEMBERSHIP_TIERS.free;

  // Check if expired
  if (mem.tier !== "free" && mem.expiresAt) {
    if (new Date(mem.expiresAt) < new Date()) {
      return MEMBERSHIP_TIERS.free;
    }
  }

  return MEMBERSHIP_TIERS[mem.tier] || MEMBERSHIP_TIERS.free;
};

/**
 * Model B: Client-side Prorated Upgrade Calculation
 */
export const calculateProratedUpgrade = (user, targetTierKey) => {
  const targetPlan = MEMBERSHIP_TIERS[targetTierKey];
  if (!targetPlan) return { payableAmount: 0, credit: 0, remainingDays: 0 };

  const currentTierConfig = getEffectiveTier(user);

  if (currentTierConfig.tier === "free" || !user?.membership?.expiresAt) {
    return {
      payableAmount: targetPlan.price,
      credit: 0,
      remainingDays: 0,
      originalPrice: targetPlan.price,
    };
  }

  if (currentTierConfig.tier === targetTierKey) {
    return {
      payableAmount: 0,
      credit: 0,
      remainingDays: 0,
      originalPrice: targetPlan.price,
    };
  }

  const currentPlan = MEMBERSHIP_TIERS[currentTierConfig.tier];
  const now = new Date();
  const expiresAt = new Date(user.membership.expiresAt);
  const totalDays = (currentPlan.durationMonths || 6) * 30; // 180 days
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  const unusedRatio = Math.min(1, Math.max(0, remainingDays / totalDays));
  const credit = Math.round(currentPlan.price * unusedRatio);

  const payableAmount = Math.max(1, targetPlan.price - credit);

  return {
    payableAmount,
    credit,
    remainingDays,
    originalPrice: targetPlan.price,
  };
};
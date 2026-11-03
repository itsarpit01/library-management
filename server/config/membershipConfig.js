export const MEMBERSHIP_TIERS = {
  free: {
    tier: "free",
    name: "Free",
    maxBooks: 3,
    maxIssueDays: 14, // 2 weeks (14 days)
    durationMonths: null,
    price: 0,
    description: "Standard access for casual readers",
  },
  premium: {
    tier: "premium",
    name: "Premium",
    maxBooks: 10,
    maxIssueDays: 30, // 1 month (30 days)
    durationMonths: 6, // 6 months validity
    price: 499,
    description: "Enhanced limit for active learners",
  },
  ultimate: {
    tier: "ultimate",
    name: "Ultimate",
    maxBooks: Infinity, // Unlimited books
    maxIssueDays: 60, // 2 months (60 days)
    durationMonths: 12, // 1 year validity
    price: 999,
    description: "Unlimited books and maximum duration for voracious readers",
  },
};

/**
 * Returns user's active tier configuration.
 * Automatically falls back to 'free' if paid tier has expired.
 */
export const getUserTierConfig = (user) => {
  const membership = user?.membership || { tier: "free", expiresAt: null };

  if (membership.tier !== "free" && membership.expiresAt) {
    if (new Date(membership.expiresAt) < new Date()) {
      return MEMBERSHIP_TIERS.free;
    }
  }

  return MEMBERSHIP_TIERS[membership.tier] || MEMBERSHIP_TIERS.free;
};

/**
 * Model B: Prorated Upgrade Calculation (Daily unused credit)
 */
export const calculateProratedUpgrade = (user, targetTierKey) => {
  const targetPlan = MEMBERSHIP_TIERS[targetTierKey];
  if (!targetPlan) return { payableAmount: 0, credit: 0, remainingDays: 0 };

  const currentTierConfig = getUserTierConfig(user);

  // Agar user free par hai ya koi active paid plan nahi hai
  if (currentTierConfig.tier === "free" || !user?.membership?.expiresAt) {
    return {
      payableAmount: targetPlan.price,
      credit: 0,
      remainingDays: 0,
      originalPrice: targetPlan.price,
    };
  }

  // Agar same ya lower plan hai
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
  const totalDays = (currentPlan.durationMonths || 6) * 30; // 180 days for 6 months
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  // Unused ratio between 0 and 1
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
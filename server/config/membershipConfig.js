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
    maxBooks: Infinity, // Unlimited books! 🚀
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
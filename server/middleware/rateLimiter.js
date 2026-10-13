import rateLimit from "express-rate-limit";

const handler = (message) => (req, res) =>
  res.status(429).json({ message });

// Poori API par: 15 minute mein 300 requests per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many requests, please try again later"),
});

// Login: 15 minute mein 10 galat attempts (successful login count nahi hota)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many login attempts, please try again in 15 minutes"),
});

// Register: ek IP se ghante mein 10 accounts
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.REGISTER_LIMIT_MAX) || 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many accounts created, please try again later"),
});
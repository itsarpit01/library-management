import express from "express";
import {
  register,
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/authValidator.js";
import {
  loginLimiter,
  registerLimiter,
  forgotLimiter,
  resetLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", protect, me); // protect yahin lagta hai, kyunki /auth public group mein hai
router.post("/forgot-password", forgotLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", resetLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
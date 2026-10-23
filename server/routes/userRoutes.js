import express from "express";
import {
  getMembers,
  getMe,
  updateMe,
  changePassword,
  upgradeMembership, // ← Added
} from "../controllers/userController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { passwordLimiter } from "../middleware/rateLimiter.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/userValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(protect);

// Har logged-in user
router.get("/me", getMe);
router.patch("/me", upload.single("avatar"), validate(updateProfileSchema), updateMe);
router.patch("/me/password", passwordLimiter, validate(changePasswordSchema), changePassword);
router.post("/upgrade-membership", upgradeMembership); // ← Added endpoint

// Sirf librarian
router.get("/members", authorizeRoles("librarian"), getMembers);

export default router;
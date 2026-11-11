import express from "express";
import {
  getMembers,
  getMemberActivity,
  getMe,
  updateMe,
  changePassword,
  upgradeMembership,
  getDeletionEligibility,
  requestAccountDeletion,
  verifyDeleteToken,
  confirmAccountDeletion,
} from "../controllers/userController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { passwordLimiter } from "../middleware/rateLimiter.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/userValidator.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public endpoints for email magic link confirmation
router.get("/verify-delete-token/:token", verifyDeleteToken);
router.post("/confirm-account-deletion", confirmAccountDeletion);

// All routes below require active logged-in user
router.use(protect);

router.get("/me", getMe);
router.patch("/me", upload.single("avatar"), validate(updateProfileSchema), updateMe);
router.patch("/me/password", passwordLimiter, validate(changePasswordSchema), changePassword);
router.post("/upgrade-membership", upgradeMembership);

// Account deletion initiation endpoints
router.get("/deletion-eligibility", getDeletionEligibility);
router.post("/request-account-deletion", requestAccountDeletion);

// Librarian only endpoints
router.get("/members", authorizeRoles("librarian"), getMembers);
router.get("/members/:id/activity", authorizeRoles("librarian"), getMemberActivity);

export default router;
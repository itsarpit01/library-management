import express from "express";
import { getMembers } from "../controllers/userController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// protect routes/index.js mein pehle se lagta hai
router.use(authorizeRoles("librarian"));

router.get("/members", getMembers);

export default router;
import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", getMyNotifications);
router.patch("/read-all", markAllAsRead);
router.delete("/clear-all", clearAllNotifications);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;
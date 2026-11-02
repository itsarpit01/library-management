import Notification from "../models/Notification.js";
import User from "../models/User.js";

// GET /api/notifications
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper: Specific User ko notification bhejna
export const sendNotification = async ({ userId, title, message, type = "info", link = "" }) => {
  try {
    return await Notification.create({ user: userId, title, message, type, link });
  } catch (err) {
    console.error("sendNotification error:", err);
  }
};

// Helper: Saare Librarians ko notification bhejna
export const notifyLibrarians = async ({ title, message, type = "info", link = "" }) => {
  try {
    const librarians = await User.find({ role: "librarian" }).select("_id");
    const docs = librarians.map((l) => ({
      user: l._id,
      title,
      message,
      type,
      link,
    }));
    if (docs.length) {
      await Notification.insertMany(docs);
    }
  } catch (err) {
    console.error("notifyLibrarians error:", err);
  }
};
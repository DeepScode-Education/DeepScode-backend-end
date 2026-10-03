// controllers/notification.controller.js
//
// GET  /api/notifications          — current user's notifications (newest first)
// GET  /api/notifications/unread   — unread count only (for bell badge)
// PATCH /api/notifications/:id/read — mark one as read
// PATCH /api/notifications/read-all — mark all as read
// DELETE /api/notifications/:id    — delete one

const Notification = require("../models/Notification");

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

// GET /api/notifications
const getMyNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = "false" } = req.query;
    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(50, parseInt(limit, 10) || 20);

    const filter = { userId: req.user.id };
    if (unreadOnly === "true") filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user.id, isRead: false }),
    ]);

    return send(res, 200, true, "Notifications fetched", notifications, {
      unreadCount,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getMyNotifications error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/notifications/unread
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    return send(res, 200, true, "Unread count", null, { count });
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// PATCH /api/notifications/:id/read
const markOneRead = async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!n) return send(res, 404, false, "Notification not found");
    return send(res, 200, true, "Marked as read", n);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    const { modifiedCount } = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return send(res, 200, true, `${modifiedCount} notification(s) marked as read`, null, { modifiedCount });
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!n) return send(res, 404, false, "Notification not found");
    return send(res, 200, true, "Notification deleted");
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

module.exports = { getMyNotifications, getUnreadCount, markOneRead, markAllRead, deleteNotification };
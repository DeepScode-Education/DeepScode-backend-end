// routes/notification.routes.js
// Mount in index.js: app.use("/api/notifications", notificationRoutes);

const express = require("express");
const router  = express.Router();

const { auth } = require("../middleware/auth.middleware");
const {
  getMyNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteNotification,
} = require("../controllers/notification.controller");

router.get(   "/",            auth, getMyNotifications);
router.get(   "/unread",      auth, getUnreadCount);
router.patch( "/read-all",    auth, markAllRead);
router.patch( "/:id/read",    auth, markOneRead);
router.delete("/:id",         auth, deleteNotification);

module.exports = router;
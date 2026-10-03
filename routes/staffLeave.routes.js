const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const {
  requirePermission,
  requireAnyPermission,
} = require("../middleware/permission.middleware");
const {
  createLeave,
  getMyLeaves,
  getAllLeaves,
  reviewLeave,
  cancelLeave,
} = require("../controllers/staffLeave.controller");

router.post("/", auth, requirePermission("leave.create"), createLeave);

router.get("/me", auth, requirePermission("leave.view"), getMyLeaves);

router.get("/", auth, requirePermission("leave.view"), getAllLeaves);

router.patch(
  "/:id/review",
  auth,
  requireAnyPermission("leave.approve", "leave.reject"),
  reviewLeave,
);

router.patch("/:id/cancel", auth, requirePermission("leave.create"), cancelLeave);

module.exports = router;

const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  getStaffAttendance,
  markStaffAttendance,
  getMyAttendance,
} = require("../controllers/staffAttendance.controller");

router.get("/me", auth, requirePermission("attendance.view"), getMyAttendance);

router.get("/:id", auth, requirePermission("attendance.view"), getStaffAttendance);

router.put("/:id", auth, requirePermission("attendance.manage"), markStaffAttendance);

module.exports = router;

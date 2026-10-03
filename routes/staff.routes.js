const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

const {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deactivateStaff,
  activateStaff,
  resetStaffPassword,
  deleteStaff,
  getStaffDetails,
  getStaffActivity,
} = require("../controllers/staff.controller");

// ─────────────────────────────────────────────────────────────────────────────
// STAFF ROUTES
// Base: /api/staff
//
// Security layers:
// 1. auth           → valid JWT required
// 2. requirePermission → granular permission check
// ─────────────────────────────────────────────────────────────────────────────

router.use(auth);

// ── READ ──────────────────────────────────────────────────────────────────────

// GET /api/staff
router.get("/", requirePermission("employees.view"), getAllStaff);

// GET /api/staff/:id
router.get("/:id/details", requirePermission("employees.view"), getStaffDetails);

router.get("/:id/activity", requirePermission("employees.view"), getStaffActivity);

// GET /api/staff/:id
router.get("/:id", requirePermission("employees.view"), getStaffById);

// ── CREATE ────────────────────────────────────────────────────────────────────

// POST /api/staff
router.post("/", requirePermission("employees.create"), createStaff);

// ── UPDATE ────────────────────────────────────────────────────────────────────

// PUT /api/staff/:id
router.put("/:id", requirePermission("employees.edit"), updateStaff);

// ── STATUS ────────────────────────────────────────────────────────────────────

// PATCH /api/staff/:id/deactivate
router.patch(
  "/:id/deactivate",
  requirePermission("employees.edit"),
  deactivateStaff,
);

// PATCH /api/staff/:id/activate
router.patch(
  "/:id/activate",
  requirePermission("employees.edit"),
  activateStaff,
);

// PATCH /api/staff/:id/reset-password
router.patch(
  "/:id/reset-password",
  requirePermission("employees.edit"),
  resetStaffPassword,
);

// ── DELETE ────────────────────────────────────────────────────────────────────

// DELETE /api/staff/:id
router.delete("/:id", requirePermission("employees.delete"), deleteStaff);

module.exports = router;

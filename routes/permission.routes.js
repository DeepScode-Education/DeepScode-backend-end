// routes/permission.routes.js

const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");

const {
  getMyPermissions,
  getPermissionCatalog,
  getStaffPermissions,
  updateStaffPermissions,
} = require("../controllers/permission.controller");

// Logged-in user: used by the common Staff Dashboard to build the sidebar.
router.get("/me", auth, getMyPermissions);

// Super Admin: complete permission registry for the permission-management UI.
router.get(
  "/catalog",
  auth,
  requirePermission("employees.permissions"),
  getPermissionCatalog
);

// Super Admin: read a staff member's effective permissions.
router.get(
  "/staff/:id",
  auth,
  requirePermission("employees.permissions"),
  getStaffPermissions
);

// Super Admin: replace a staff member's permission overrides.
router.put(
  "/staff/:id",
  auth,
  requirePermission("employees.permissions"),
  updateStaffPermissions
);

module.exports = router;

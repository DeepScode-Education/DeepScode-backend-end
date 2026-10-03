const express = require("express");

const router = express.Router();

const { auth, isAdmin } = require("../middleware/auth.middleware");
const publicApiProtection = require("../middleware/publicApiProtection.middleware");
const {
  createAdLeadRules,
  listAdLeadRules,
  adLeadIdRules,
  updateAdLeadStatusRules,
  validate,
} = require("../validators/adLead.validator");

const {
  createAdLead,
  getAdLeads,
  getAdLeadById,
  updateAdLeadStatus,
  getAdLeadStats,
} = require("../controllers/adLead.controller");

/*
 * PUBLIC
 * Landing-page form submission.
 * No JWT is required because these visitors are anonymous.
 */
router.post(
  "/",
  publicApiProtection,
  createAdLeadRules,
  validate,
  createAdLead
);

/*
 * PRIVATE
 * Dashboard access. Existing auth + admin/super_admin RBAC is reused.
 */
router.get("/stats", auth, isAdmin, getAdLeadStats);
router.get("/", auth, isAdmin, listAdLeadRules, validate, getAdLeads);
router.get("/:id", auth, isAdmin, adLeadIdRules, validate, getAdLeadById);
router.patch(
  "/:id/status",
  auth,
  isAdmin,
  updateAdLeadStatusRules,
  validate,
  updateAdLeadStatus
);

module.exports = router;

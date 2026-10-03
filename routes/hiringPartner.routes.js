// routes/hiringPartner.routes.js
const express = require("express");
const adminRouter = express.Router();

const { auth, isAdmin } = require("../middleware/auth.middleware");
const hiringPartnerController = require("../controllers/hiringPartner.controller");

const {
  createHiringPartnerRules,
  updateHiringPartnerRules,
  hiringPartnerIdRules,
  deleteHiringPartnerRules,
  hiringPartnerListRules,
  validate,
} = require("../validators/hiringPartner.validator");

// ── Admin ── (all routes below require a valid token + admin/super_admin role)
adminRouter.use(auth, isAdmin);

// Dashboard stats — registered before "/:id" so "dashboard" is never
// swallowed as a partner ID param (same pattern as supportTicket.routes.js)
adminRouter.get("/dashboard/stats", hiringPartnerController.getDashboardStats);

adminRouter.post(
  "/",
  createHiringPartnerRules,
  validate,
  hiringPartnerController.createHiringPartner
);

adminRouter.get(
  "/",
  hiringPartnerListRules,
  validate,
  hiringPartnerController.getAllHiringPartners
);

adminRouter.get(
  "/:id/detail",
  hiringPartnerIdRules,
  validate,
  hiringPartnerController.getHiringPartnerDetail
);

adminRouter.get(
  "/:id",
  hiringPartnerIdRules,
  validate,
  hiringPartnerController.getHiringPartnerById
);

adminRouter.put(
  "/:id",
  updateHiringPartnerRules,
  validate,
  hiringPartnerController.updateHiringPartner
);

adminRouter.delete(
  "/:id",
  deleteHiringPartnerRules,
  validate,
  hiringPartnerController.deleteHiringPartner
);

module.exports = { adminRouter };
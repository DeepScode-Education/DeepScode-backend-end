// routes/opportunity.routes.js
const express = require("express");
const adminRouter = express.Router();
const publicRouter = express.Router();

const { auth, isAdmin } = require("../middleware/auth.middleware");
const parseOpportunityFields = require("../middleware/parseOpportunityFields.middleware");
const opportunityController = require("../controllers/opportunity.controller");

const uploadResume = require("../middleware/resumeUpload.middleware");
const opportunityApplicationController = require("../controllers/opportunityApplication.controller");

const {
  createOpportunityRules,
  updateOpportunityRules,
  opportunityIdRules,
  deleteOpportunityRules,
  updateStatusRules,
  opportunityListRules,
  validate,
} = require("../validators/opportunity.validator");

// ── Admin ── (all routes below require a valid token + admin/super_admin role)
adminRouter.use(auth, isAdmin);

// Single endpoint for the entire 6-step wizard payload
adminRouter.post(
  "/",
  parseOpportunityFields,
  createOpportunityRules,
  validate,
  opportunityController.createOpportunity
);

// Admin listing — pagination + search + filters (status, department, visibility)
adminRouter.get(
  "/",
  opportunityListRules,
  validate,
  opportunityController.getAllOpportunities
);

adminRouter.get(
  "/:id",
  opportunityIdRules,
  validate,
  opportunityController.getOpportunityById
);

// Same wizard payload shape — used for edits and for "Publish" from the Review step
adminRouter.put(
  "/:id",
  parseOpportunityFields,
  updateOpportunityRules,
  validate,
  opportunityController.updateOpportunity
);

// Soft delete
adminRouter.delete(
  "/:id",
  deleteOpportunityRules,
  validate,
  opportunityController.deleteOpportunity
);

// Draft <-> Published toggle
adminRouter.patch(
  "/:id/status",
  updateStatusRules,
  validate,
  opportunityController.updateStatus
);

adminRouter.get("/:id/applications", opportunityApplicationController.getApplicationsForOpportunity);
adminRouter.patch("/applications/:appId/status", opportunityApplicationController.updateApplicationStatus);

// ── Public ── (no auth — published + visibility: Public only, enforced in the service)
publicRouter.get("/", opportunityController.getPublishedOpportunities);

publicRouter.post(
  "/:id/apply",
  auth,
  uploadResume.single("resume"),
  opportunityApplicationController.applyToOpportunity
);

module.exports = { adminRouter, publicRouter };

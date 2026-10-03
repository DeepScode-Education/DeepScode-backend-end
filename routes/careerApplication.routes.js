const express = require("express");

const router = express.Router();

const {
  auth,
  isAdmin,
} = require("../middleware/auth.middleware");

const uploadResume = require("../middleware/resumeUpload.middleware");

const {
  applyForCareer,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getDashboardStats,
} = require("../controllers/careerApplication.controller");

const {
  applyCareerRules,
  updateApplicationStatusRules,
  validate,
} = require("../validators/careerApplication.validator");


router.post(
  "/:careerId/apply",
  uploadResume.single("resume"),
  applyCareerRules,
  validate,
  applyForCareer
);

router.get(
  "/admin/dashboard",
  auth,
  isAdmin,
  getDashboardStats
);

// List Applications
router.get(
  "/admin",
  auth,
  isAdmin,
  getApplications
);

// Single Application
router.get(
  "/admin/:id",
  auth,
  isAdmin,
  getApplicationById
);

// Update Status
router.patch(
  "/admin/:id/status",
  auth,
  isAdmin,
  updateApplicationStatusRules,
  validate,
  updateApplicationStatus
);

// Delete
router.delete(
  "/admin/:id",
  auth,
  isAdmin,
  deleteApplication
);

module.exports = router;
const express = require("express");

const router = express.Router();

const {
  getPublishedCareers,
  getCareerBySlug,
} = require("../controllers/career.controller");

// Public Career List
router.get("/", getPublishedCareers);

// Single Career
router.get("/:slug", getCareerBySlug);

module.exports = router;
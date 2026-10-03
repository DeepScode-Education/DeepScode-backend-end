const express = require("express");
const router = express.Router();
const { getGlobalAnalytics } = require("../controllers/Reports.controller");

// GET /api/reports/global?days=30
router.get("/global", getGlobalAnalytics);

module.exports = router;
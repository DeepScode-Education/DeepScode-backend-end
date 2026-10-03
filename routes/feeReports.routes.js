// routes/feeReports.routes.js
//
// Mounted at /api/fee-reports in index.js.
// Kept as a separate top-level path (not under /api/fee-collection) so it
// never collides with the existing "/:studentId" param route there.

const express = require("express");
const router = express.Router();

const { auth, isAdmin } = require("../middleware/auth.middleware");
const { getFeeCollectionReports } = require("../controllers/feeReports.controller");

router.get("/", auth, isAdmin, getFeeCollectionReports);

module.exports = router;
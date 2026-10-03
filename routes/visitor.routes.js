const express = require("express");
const router = express.Router();

const { updateVisitorLocation } = require("../controllers/visitorLocation.controller");

// Public — identified via the httpOnly visitor cookie, not auth.
// Lives under /api, so visitorTracker's IGNORED_PREFIXES ("/api") already
// excludes it from being tracked as a page-view itself, avoiding loops.
router.post("/location", updateVisitorLocation);

module.exports = router;
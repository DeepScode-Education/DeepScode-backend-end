// routes/phoneOtp.routes.js
const express = require("express");
const router = express.Router();

const { verifyAccessToken } = require("../controllers/phoneOtp.controller");

// POST /api/phone-otp/verify-token
// Public — same trust level as /api/email-otp, no auth required, since this
// runs during the anonymous public application flow.
router.post("/verify-token", verifyAccessToken);

module.exports = router;
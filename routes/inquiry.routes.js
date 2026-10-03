

// const express = require("express");
// const router = express.Router();
// const { createInquiry, getAllInquiries, getInquiryById } = require("../controllers/inquiry.controller");
// const { inquiryRules, validate } = require("../validators/inquiryValidator");
// const { auth, optionalAuth } = require("../middleware/auth.middleware");

// const { isCounsellor } = require("../middleware/roles.middleware");

// router.post("/", optionalAuth, inquiryRules, validate, createInquiry);
// router.get("/", auth, isCounsellor, getAllInquiries);
// router.get("/:id", auth, isCounsellor, getInquiryById);

// module.exports = router;




const express = require("express");
const router = express.Router();
const { createInquiry, getAllInquiries, getInquiryById } = require("../controllers/inquiry.controller");
const { inquiryRules, validate } = require("../validators/inquiryValidator");
const { optionalAuth, auth, isAdmin } = require("../middleware/auth.middleware");
const publicApiProtection = require("../middleware/publicApiProtection.middleware");

// PUBLIC — contact/inquiry form submission only. Origin-gated + validated.
router.post("/", publicApiProtection, optionalAuth, inquiryRules, validate, createInquiry);

// PRIVATE — CRM/lead data. Never public. Staff-only from here on.
router.get("/", auth, isAdmin, getAllInquiries);
router.get("/:id", auth, isAdmin, getInquiryById);

module.exports = router;
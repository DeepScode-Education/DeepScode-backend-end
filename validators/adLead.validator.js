const { body, param, query, validationResult } = require("express-validator");

const AD_LEAD_STATUSES = ["new", "contacted", "interested", "follow-up", "converted", "lost"];
const AD_LEAD_FORM_TYPES = ["enroll_now", "secure_spot"];

const createAdLeadRules = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required.")
    .isLength({ min: 2, max: 120 })
    .withMessage("Full name must be between 2 and 120 characters."),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Enter a valid email address.")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Enter a valid 10-digit Indian mobile number."),

  body("course")
    .trim()
    .notEmpty()
    .withMessage("Course is required.")
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}$/)
    .withMessage("Invalid course identifier."),

  body("formType")
    .optional()
    .isIn(AD_LEAD_FORM_TYPES)
    .withMessage("Invalid form type."),

  body("city").optional().trim().isLength({ max: 120 }),
  body("profile").optional().trim().isLength({ max: 160 }),
  body("mode").optional().trim().isLength({ max: 100 }),
  body("experience").optional().trim().isLength({ max: 160 }),
  body("landingPage").optional().trim().isLength({ max: 255 }),
  body("campaign").optional().trim().isLength({ max: 255 }),
  body("adGroup").optional().trim().isLength({ max: 255 }),
  body("keyword").optional().trim().isLength({ max: 255 }),
  body("utmSource").optional().trim().isLength({ max: 255 }),
  body("utmMedium").optional().trim().isLength({ max: 255 }),
  body("utmCampaign").optional().trim().isLength({ max: 255 }),
  body("utmTerm").optional().trim().isLength({ max: 255 }),
  body("utmContent").optional().trim().isLength({ max: 255 }),
];

const listAdLeadRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status").optional().isIn(AD_LEAD_STATUSES),
  query("formType").optional().isIn(AD_LEAD_FORM_TYPES),
];

const adLeadIdRules = [
  param("id").isMongoId().withMessage("Invalid ad lead ID."),
];

const updateAdLeadStatusRules = [
  ...adLeadIdRules,
  body("status")
    .notEmpty()
    .isIn(AD_LEAD_STATUSES)
    .withMessage("Invalid lead status."),
  body("notes").optional().trim().isLength({ max: 2000 }),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed.",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  next();
};

module.exports = {
  createAdLeadRules,
  listAdLeadRules,
  adLeadIdRules,
  updateAdLeadStatusRules,
  validate,
};

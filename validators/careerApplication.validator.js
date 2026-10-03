const { body, param, validationResult } = require("express-validator");



const applyCareerRules = [
  param("careerId")
    .isMongoId()
    .withMessage("Invalid Career ID"),

  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Enter a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Enter a valid Indian mobile number"),

  body("currentCompany")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Current company name is too long"),

  body("experience")
    .optional()
    .isFloat({ min: 0, max: 40 })
    .withMessage("Experience must be between 0 and 40 years"),

  body("currentCTC")
    .optional()
    .isNumeric()
    .withMessage("Current CTC must be numeric"),

  body("expectedCTC")
    .optional()
    .isNumeric()
    .withMessage("Expected CTC must be numeric"),

  body("noticePeriod")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Notice period is too long"),

  body("portfolio")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Portfolio URL is invalid"),

  body("linkedIn")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("LinkedIn URL is invalid"),

  body("github")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("GitHub URL is invalid"),

  body("coverLetter")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Cover letter is too long"),
];

/* -------------------------------------------------------------------------- */
/*                              Status Update                                 */
/* -------------------------------------------------------------------------- */

const updateApplicationStatusRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Application ID"),

  body("status")
    .isIn([
      "Applied",
      "Shortlisted",
      "Interview Scheduled",
      "Interviewed",
      "Selected",
      "Rejected",
    ])
    .withMessage("Invalid application status"),
];

/* -------------------------------------------------------------------------- */
/*                                 Validate                                   */
/* -------------------------------------------------------------------------- */

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }

  next();
};

module.exports = {
  applyCareerRules,
  updateApplicationStatusRules,
  validate,
};
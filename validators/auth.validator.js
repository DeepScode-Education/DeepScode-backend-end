const { body, validationResult } = require("express-validator");

// ─── Shared rule builders ──────────────────────────────────────────────────────

const identifierRule = () =>
  body("identifier")
    .trim()
    .notEmpty().withMessage("Email or Student ID is required");

const passwordRule = (minLength = 6) =>
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: minLength }).withMessage(`Password must be at least ${minLength} characters`);

const fullNameRule = () =>
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Full name must be 2–100 characters");

const emailRule = () =>
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Enter a valid email address")
    .normalizeEmail();

const otpRule = () =>
  body("otp")
    .trim()
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 6, max: 6 }).withMessage("OTP must be exactly 6 digits")
    .isNumeric().withMessage("OTP must contain only digits");

// ─── Rule sets ────────────────────────────────────────────────────────────────

const loginRules = [
  identifierRule(),
  passwordRule(),
];

const registerRules = [
  fullNameRule(),
  emailRule(),
  passwordRule(6),
];

const sendOtpRules = [
  emailRule(),
];

const verifyOtpRules = [
  emailRule(),
  otpRule(),
];

// ── Forgot / Reset Password (OTP flow) ──────────────────────────────────────────

const forgotPasswordRules = [
  emailRule(),
];

const verifyResetOtpRules = [
  emailRule(),
  otpRule(),
];

const resetPasswordRules = [
  emailRule(),
  otpRule(),
  passwordRule(8),
];

// ─── Validation middleware ─────────────────────────────────────────────────────

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = {
  loginRules,
  registerRules,
  sendOtpRules,
  verifyOtpRules,
  forgotPasswordRules,
  verifyResetOtpRules,
  resetPasswordRules,
  validate,
};
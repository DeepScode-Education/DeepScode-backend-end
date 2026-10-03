// const express = require("express");
// const router  = express.Router();

// const { register, login, getMe, forgotPassword, resetPassword, verifyResetToken } = require("../controllers/auth.controller");
// const { auth }                   = require("../middleware/auth.middleware");
// const {
//   loginRules,
//   registerRules,
//   forgotPasswordRules,
//   resetPasswordRules,
//   validate,
// } = require("../validators/auth.validator");

// // ─── Public ────────────────────────────────────────────────────────────────────

// router.post("/register", registerRules, validate, register);
// router.post("/login", loginRules, validate, login);

// // ── NEW: Forgot / Reset password ────────────────────────────────────────────────
// router.post("/forgot-password", forgotPasswordRules, validate, forgotPassword);
// router.get("/verify-reset-token/:token", verifyResetToken);
// router.post("/reset-password/:token", resetPasswordRules, validate, resetPassword);

// // ─── Protected ────────────────────────────────────────────────────────────────

// router.get("/me", auth, getMe);
// router.get("/profile", auth, getMe);

// module.exports = router;



const express = require("express");
const router  = express.Router();

const {
  register,
  login,
  getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require("../controllers/auth.controller");
const { auth } = require("../middleware/auth.middleware");
const {
  loginRules,
  registerRules,
  forgotPasswordRules,
  verifyResetOtpRules,
  resetPasswordRules,
  validate,
} = require("../validators/auth.validator");

// ─── Public ────────────────────────────────────────────────────────────────────

router.post("/register", registerRules, validate, register);
router.post("/login", loginRules, validate, login);

// ── Forgot / Reset password — OTP flow ──────────────────────────────────────────
router.post("/forgot-password", forgotPasswordRules, validate, forgotPassword);
router.post("/verify-reset-otp", verifyResetOtpRules, validate, verifyResetOtp);
router.post("/reset-password", resetPasswordRules, validate, resetPassword);

// ─── Protected ────────────────────────────────────────────────────────────────

router.get("/me", auth, getMe);
router.get("/profile", auth, getMe);

module.exports = router;
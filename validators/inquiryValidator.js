
const { body, validationResult } = require("express-validator");
const Course = require("../models/Course"); 

const inquiryRules = [
  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required")
    .isLength({ min: 2 }).withMessage("Name too short"),

  body("mobileNumber")
    .trim()
    .notEmpty().withMessage("Mobile number is required")
    .matches(/^[6-9]\d{9}$/).withMessage("Enter a valid 10-digit Indian mobile number"),

  // Email ab optional — sirf format check, jab value ho
  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage("Enter a valid email"),

  // FIX: yeh model ke actual enum se match karta hai (pehle "Design" allow
  // karta tha jo Model mein exist hi nahi karta — woh hamesha 500 deta tha)
  body("course")
    .notEmpty().withMessage("Course is required")
    .isMongoId().withMessage("Invalid course selected")
    .bail()
    .custom(async (value) => {
      const course = await Course.findById(value).select("_id");
      if (!course) throw new Error("Selected course does not exist");
      return true;
    }),

  body("source")
    .optional()
    .isIn(["Website", "WhatsApp", "Instagram", "Facebook", "Referral", "Other", "Manual"]),

  body("remarks").optional().trim(),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { inquiryRules, validate };
// modules/live-class/validators/liveClass.validator.js

const { body, validationResult } = require("express-validator");
const { BATCH_DAYS, BATCH_TIMES } = require("../../../models/Studentassignment");

const startClassRules = [
  body("courseId").isMongoId().withMessage("Valid courseId is required"),
  body("days").isIn(BATCH_DAYS).withMessage(`days must be one of: ${BATCH_DAYS.join(", ")}`),
  body("time").isIn(BATCH_TIMES).withMessage(`time must be one of: ${BATCH_TIMES.join(", ")}`),
  body("title").optional().trim().isLength({ max: 150 }),
];

const liveClassIdRules = [
  body("liveClassId").isMongoId().withMessage("Valid liveClassId is required"),
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

module.exports = { startClassRules, liveClassIdRules, validate };
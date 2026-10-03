const { body, param, query, validationResult } = require("express-validator");
const { WORK_MODES, PAY_PERIODS, VISIBILITIES, STATUSES } = require("../models/Opportunity");

// ─── Create — full 6-step wizard payload ───────────────────────────────────────
const createOpportunityRules = [
  // Step 1: Basic Info
  body("basic.hiringPartner")
    .optional({ checkFalsy: true })
    .isMongoId().withMessage("Invalid hiring partner ID"),
  // Hiring Manager is a free-text external person's name — NOT a system user,
  // so it must never be validated as a MongoDB ObjectId.
  body("basic.hiringManager")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage("Hiring manager name must be under 150 characters"),
  body("basic.urgentRequirement")
    .optional()
    .isBoolean().withMessage("urgentRequirement must be true or false"),

  // Step 2: Role Details
  body("role.jobTitle")
    .trim()
    .notEmpty().withMessage("Job title is required")
    .isLength({ max: 150 }).withMessage("Job title must be under 150 characters"),
  body("role.workMode")
    .optional()
    .isIn(WORK_MODES).withMessage(`Work mode must be one of: ${WORK_MODES.join(", ")}`),
  body("role.openings")
    .optional()
    .isInt({ min: 1 }).withMessage("Openings must be at least 1"),
  body("role.requiredSkills")
    .optional()
    .isArray().withMessage("requiredSkills must be an array"),
  body("role.niceToHaveSkills")
    .optional()
    .isArray().withMessage("niceToHaveSkills must be an array"),

  // Step 3: Compensation
  body("compensation.payPeriod")
    .optional()
    .isIn(PAY_PERIODS).withMessage(`Pay period must be one of: ${PAY_PERIODS.join(", ")}`),
  body("compensation.payMin")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage("payMin must be a non-negative number"),
  body("compensation.payMax")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage("payMax must be a non-negative number"),
  body("compensation.benefits")
    .optional()
    .isArray().withMessage("benefits must be an array"),
  body("compensation.performanceBonus").optional().isBoolean(),
  body("compensation.performanceBonusValue").optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body("compensation.signOnBonus").optional().isBoolean(),
  body("compensation.signOnBonusValue").optional({ checkFalsy: true }).isFloat({ min: 0 }),

  // Step 4: Eligibility
  body("eligibility.minYears").optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage("minYears must be a non-negative number"),
  body("eligibility.workAuthRequired").optional().isBoolean(),
  body("eligibility.backgroundCheck").optional().isBoolean(),

  // Step 5: Settings
  body("settings.visibility")
    .optional()
    .isIn(VISIBILITIES).withMessage(`Visibility must be one of: ${VISIBILITIES.join(", ")}`),
  body("settings.applicationDeadline")
    .optional({ checkFalsy: true })
    .isISO8601().withMessage("applicationDeadline must be a valid date"),
  body("settings.applicationLimit")
    .optional({ checkFalsy: true })
    .isInt({ min: 0 }).withMessage("applicationLimit must be a non-negative integer"),
  body("settings.autoScreening").optional().isBoolean(),
  body("settings.alertRecipients").optional().isArray().withMessage("alertRecipients must be an array"),

  // Status (only present when publishing straight from the wizard)
  body("status")
    .optional()
    .isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(", ")}`),
];

// ─── Update — same shape, everything optional since it's a partial-safe payload ─
const updateOpportunityRules = [
  param("id").isMongoId().withMessage("Invalid Opportunity ID"),

  // FIX: hiringPartner (the real relation to the HiringPartner collection)
  // is validated as a Mongo ID.
  body("basic.hiringPartner")
    .optional({ checkFalsy: true })
    .isMongoId().withMessage("Invalid hiring partner ID"),
  // FIX: hiringManager is a free-text external person's name, NOT a Mongo
  // ID — this previously used .isMongoId(), which rejected every valid
  // edit save since the admin types a plain name here.
  body("basic.hiringManager")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage("Hiring manager name must be under 150 characters"),
  body("basic.urgentRequirement").optional().isBoolean(),

  body("role.jobTitle").optional().trim().isLength({ max: 150 }).withMessage("Job title must be under 150 characters"),
  body("role.workMode").optional().isIn(WORK_MODES).withMessage(`Work mode must be one of: ${WORK_MODES.join(", ")}`),
  body("role.openings").optional().isInt({ min: 1 }).withMessage("Openings must be at least 1"),
  body("role.requiredSkills").optional().isArray(),
  body("role.niceToHaveSkills").optional().isArray(),

  body("compensation.payPeriod").optional().isIn(PAY_PERIODS),
  body("compensation.payMin").optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body("compensation.payMax").optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body("compensation.benefits").optional().isArray(),
  body("compensation.performanceBonus").optional().isBoolean(),
  body("compensation.performanceBonusValue").optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body("compensation.signOnBonus").optional().isBoolean(),
  body("compensation.signOnBonusValue").optional({ checkFalsy: true }).isFloat({ min: 0 }),

  body("eligibility.minYears").optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body("eligibility.workAuthRequired").optional().isBoolean(),
  body("eligibility.backgroundCheck").optional().isBoolean(),

  body("settings.visibility").optional().isIn(VISIBILITIES),
  body("settings.applicationDeadline").optional({ checkFalsy: true }).isISO8601(),
  body("settings.applicationLimit").optional({ checkFalsy: true }).isInt({ min: 0 }),
  body("settings.autoScreening").optional().isBoolean(),
  body("settings.alertRecipients").optional().isArray(),

  body("status").optional().isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(", ")}`),
];

const opportunityIdRules = [
  param("id").isMongoId().withMessage("Invalid Opportunity ID"),
];

const deleteOpportunityRules = [
  param("id").isMongoId().withMessage("Invalid Opportunity ID"),
];

const updateStatusRules = [
  param("id").isMongoId().withMessage("Invalid Opportunity ID"),
  body("status")
    .notEmpty().withMessage("Status is required")
    .isIn(STATUSES).withMessage(`Status must be one of: ${STATUSES.join(", ")}`),
];

const opportunityListRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status").optional().isIn(STATUSES),
];

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
  createOpportunityRules,
  updateOpportunityRules,
  opportunityIdRules,
  deleteOpportunityRules,
  updateStatusRules,
  opportunityListRules,
  validate,
};
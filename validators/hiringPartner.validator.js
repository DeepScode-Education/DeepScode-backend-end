const { body, param, query, validationResult } = require("express-validator");
const { TIERS } = require("../models/HiringPartner");

const createHiringPartnerRules = [
  body("companyName")
    .trim()
    .notEmpty().withMessage("Company name is required")
    .isLength({ max: 150 }).withMessage("Company name must be under 150 characters"),
  body("industry").optional().trim().isLength({ max: 100 }),
  body("logo").optional({ checkFalsy: true }).isString(),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("website").optional({ checkFalsy: true }).isURL().withMessage("Website must be a valid URL"),
  body("tier").optional().isIn(TIERS).withMessage(`Tier must be one of: ${TIERS.join(", ")}`),
  body("isActive").optional().isBoolean(),
  body("totalHires").optional().isInt({ min: 0 }).withMessage("totalHires must be a non-negative integer"),
];

const updateHiringPartnerRules = [
  param("id").isMongoId().withMessage("Invalid Hiring Partner ID"),
  body("companyName").optional().trim().isLength({ max: 150 }),
  body("industry").optional().trim().isLength({ max: 100 }),
  body("logo").optional({ checkFalsy: true }).isString(),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("website").optional({ checkFalsy: true }).isURL().withMessage("Website must be a valid URL"),
  body("tier").optional().isIn(TIERS).withMessage(`Tier must be one of: ${TIERS.join(", ")}`),
  body("isActive").optional().isBoolean(),
  body("totalHires").optional().isInt({ min: 0 }).withMessage("totalHires must be a non-negative integer"),
];

const hiringPartnerIdRules = [
  param("id").isMongoId().withMessage("Invalid Hiring Partner ID"),
];

const deleteHiringPartnerRules = [
  param("id").isMongoId().withMessage("Invalid Hiring Partner ID"),
];

const hiringPartnerListRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("tier").optional().isIn(TIERS),
  query("isActive").optional().isIn(["true", "false", ""]),
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

module.exports = {
  createHiringPartnerRules,
  updateHiringPartnerRules,
  hiringPartnerIdRules,
  deleteHiringPartnerRules,
  hiringPartnerListRules,
  validate,
};
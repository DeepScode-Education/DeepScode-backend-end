const { body, param, query, validationResult } = require("express-validator");


const createCareerRules = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Job title is required")
    .isLength({ min: 3, max: 120 })
    .withMessage("Job title must be between 3 and 120 characters"),

  body("department")
    .trim()
    .notEmpty()
    .withMessage("Department is required"),

  body("location")
    .trim()
    .notEmpty()
    .withMessage("Location is required"),

  body("workMode")
    .optional()
    .isIn(["Remote", "Hybrid", "Onsite"])
    .withMessage("Invalid work mode"),

  body("employmentType")
    .optional()
    .isIn([
      "Full Time",
      "Part Time",
      "Internship",
      "Contract",
      "Freelance",
    ])
    .withMessage("Invalid employment type"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required"),

  body("experience.min")
    .optional()
    .isNumeric()
    .withMessage("Minimum experience must be numeric"),

  body("experience.max")
    .optional()
    .isNumeric()
    .withMessage("Maximum experience must be numeric"),

  body("salary.min")
    .optional()
    .isNumeric()
    .withMessage("Minimum salary must be numeric"),

  body("salary.max")
    .optional()
    .isNumeric()
    .withMessage("Maximum salary must be numeric"),

  body("requirements")
    .optional()
    .isArray()
    .withMessage("Requirements must be an array"),

  body("responsibilities")
    .optional()
    .isArray()
    .withMessage("Responsibilities must be an array"),

  body("skills")
    .optional()
    .isArray()
    .withMessage("Skills must be an array"),

  body("benefits")
    .optional()
    .isArray()
    .withMessage("Benefits must be an array"),

  body("status")
    .optional()
    .isIn(["Draft", "Published", "Closed"])
    .withMessage("Invalid status"),
];

const updateCareerRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Career ID"),
];

const careerIdRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Career ID"),
];

const deleteCareerRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Career ID"),
];

const careerListRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1 }),
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
  createCareerRules,
  updateCareerRules,
  careerIdRules,
  deleteCareerRules,
  careerListRules,
  validate,
};
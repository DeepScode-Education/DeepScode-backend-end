// const { body, param, query, validationResult } = require("express-validator");
// const { CATEGORIES } = require("../models/Course");
// /* -------------------------------------------------------------------------- */
// /*                               Create Blog                                  */
// /* -------------------------------------------------------------------------- */

// const createBlogRules = [
//   body("title")
//     .trim()
//     .notEmpty()
//     .withMessage("Blog title is required")
//     .isLength({ min: 3, max: 200 })
//     .withMessage("Blog title must be between 3 and 200 characters"),

//   body("shortDescription")
//     .trim()
//     .notEmpty()
//     .withMessage("Short description is required")
//     .isLength({ min: 20, max: 500 })
//     .withMessage("Short description must be between 20 and 500 characters"),

//   body("content")
//     .trim()
//     .notEmpty()
//     .withMessage("Blog content is required"),

// body("category")
//     .notEmpty()
//     .withMessage("Category is required")
//     .isIn(CATEGORIES)                              
//     .withMessage(`Category must be one of: ${CATEGORIES.join(", ")}`),

//   body("featured")
//     .optional()
//     .isBoolean()
//     .withMessage("Featured must be true or false"),

//   body("status")
//     .optional()
//     .isIn(["Draft", "Published"])
//     .withMessage("Invalid status"),

//   body("readTime")
//     .optional()
//     .isInt({ min: 1, max: 60 })
//     .withMessage("Read time must be between 1 and 60 minutes"),

//   body("tags")
//     .optional()
//     .isArray()
//     .withMessage("Tags must be an array"),

//   body("seoTitle")
//     .optional()
//     .isLength({ max: 200 })
//     .withMessage("SEO title cannot exceed 200 characters"),

//   body("metaDescription")
//     .optional()
//     .isLength({ max: 300 })
//     .withMessage("Meta description cannot exceed 300 characters"),
// ];

// /* -------------------------------------------------------------------------- */
// /*                                Update Blog                                 */
// /* -------------------------------------------------------------------------- */

// const updateBlogRules = [
//   param("id")
//     .isMongoId()
//     .withMessage("Invalid Blog ID"),
// ];

// /* -------------------------------------------------------------------------- */
// /*                               Get By ID                                    */
// /* -------------------------------------------------------------------------- */

// const blogIdRules = [
//   param("id")
//     .isMongoId()
//     .withMessage("Invalid Blog ID"),
// ];

// /* -------------------------------------------------------------------------- */
// /*                               Delete Blog                                  */
// /* -------------------------------------------------------------------------- */

// const deleteBlogRules = [
//   param("id")
//     .isMongoId()
//     .withMessage("Invalid Blog ID"),
// ];

// /* -------------------------------------------------------------------------- */
// /*                              Blog Listing                                  */
// /* -------------------------------------------------------------------------- */

// const blogListRules = [
//   query("page")
//     .optional()
//     .isInt({ min: 1 }),

//   query("limit")
//     .optional()
//     .isInt({ min: 1 }),

//   query("featured")
//     .optional()
//     .isBoolean(),

//   query("status")
//     .optional()
//     .isIn(["Draft", "Published"]),
// ];

// /* -------------------------------------------------------------------------- */
// /*                                 Validate                                   */
// /* -------------------------------------------------------------------------- */

// const validate = (req, res, next) => {
//   const errors = validationResult(req);

//   if (!errors.isEmpty()) {
//     return res.status(422).json({
//       success: false,
//       message: "Validation failed",
//       errors: errors.array().map((e) => ({
//         field: e.path,
//         message: e.msg,
//       })),
//     });
//   }

//   next();
// };

// module.exports = {
//   createBlogRules,
//   updateBlogRules,
//   blogIdRules,
//   deleteBlogRules,
//   blogListRules,
//   validate,
// };









const { body, param, query, validationResult } = require("express-validator");
const Course = require("../models/Course");

/* -------------------------------------------------------------------------- */
/*                               Create Blog                                  */
/* -------------------------------------------------------------------------- */

const createBlogRules = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Blog title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Blog title must be between 3 and 200 characters"),

  body("shortDescription")
    .trim()
    .notEmpty()
    .withMessage("Short description is required")
    .isLength({ min: 20, max: 500 })
    .withMessage("Short description must be between 20 and 500 characters"),

  body("content")
    .trim()
    .notEmpty()
    .withMessage("Blog content is required"),

  // CHANGED — blogs are now tagged to an actual Course document instead of
  // a fixed category enum.
  body("course")
    .notEmpty()
    .withMessage("Course is required")
    .isMongoId()
    .withMessage("Invalid course selected")
    .bail()
    .custom(async (value) => {
      const course = await Course.findById(value).select("_id");
      if (!course) throw new Error("Selected course does not exist");
      return true;
    }),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be true or false"),

  body("status")
    .optional()
    .isIn(["Draft", "Published"])
    .withMessage("Invalid status"),

  body("readTime")
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage("Read time must be between 1 and 60 minutes"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),

  body("seoTitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("SEO title cannot exceed 200 characters"),

  body("metaDescription")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Meta description cannot exceed 300 characters"),
];

/* -------------------------------------------------------------------------- */
/*                                Update Blog                                 */
/* -------------------------------------------------------------------------- */

const updateBlogRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Blog ID"),

  // NEW — course is optional on update (only re-validated if the admin
  // actually changes it), but must be a real course if provided.
  body("course")
    .optional()
    .isMongoId()
    .withMessage("Invalid course selected")
    .bail()
    .custom(async (value) => {
      if (!value) return true;
      const course = await Course.findById(value).select("_id");
      if (!course) throw new Error("Selected course does not exist");
      return true;
    }),

  body("readTime")
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage("Read time must be between 1 and 60 minutes"),

  body("seoTitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("SEO title cannot exceed 200 characters"),

  body("metaDescription")
    .optional()
    .isLength({ max: 300 })
    .withMessage("Meta description cannot exceed 300 characters"),
];

/* -------------------------------------------------------------------------- */
/*                               Get By ID                                    */
/* -------------------------------------------------------------------------- */

const blogIdRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Blog ID"),
];

/* -------------------------------------------------------------------------- */
/*                               Delete Blog                                  */
/* -------------------------------------------------------------------------- */

const deleteBlogRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid Blog ID"),
];

/* -------------------------------------------------------------------------- */
/*                              Blog Listing                                  */
/* -------------------------------------------------------------------------- */

const blogListRules = [
  query("page")
    .optional()
    .isInt({ min: 1 }),

  query("limit")
    .optional()
    .isInt({ min: 1 }),

  query("featured")
    .optional()
    .isBoolean(),

  query("status")
    .optional()
    .isIn(["Draft", "Published"]),

  // NEW
  query("course")
    .optional()
    .isMongoId()
    .withMessage("Invalid course filter"),
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
  createBlogRules,
  updateBlogRules,
  blogIdRules,
  deleteBlogRules,
  blogListRules,
  validate,
};
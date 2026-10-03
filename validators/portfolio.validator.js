const { body, param } = require("express-validator");

/*
|--------------------------------------------------------------------------
| Create Portfolio Validation
|--------------------------------------------------------------------------
*/

// const createPortfolioValidator = [
//   body("title")
//     .trim()

//     .notEmpty()

//     .withMessage("Project title is required")

//     .isLength({
//       min: 5,
//       max: 100,
//     })

//     .withMessage("Title must be between 5 and 100 characters"),

//   body("description")
//     .trim()

//     .notEmpty()

//     .withMessage("Project description is required")

//     .isLength({
//       min: 50,
//     })

//     .withMessage("Description must be minimum 50 characters"),

//   body("technologies")
//     .isArray({
//       min: 1,
//     })

//     .withMessage("At least one technology is required"),
// ];


const createPortfolioValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Project title is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Title must be between 5 and 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Project description is required")
    .isLength({ min: 50 })
    .withMessage("Description must be minimum 50 characters"),
];

/*
|--------------------------------------------------------------------------
| Update Portfolio Validation
|--------------------------------------------------------------------------
*/

const updatePortfolioValidator = [
  param("id")
    .isMongoId()

    .withMessage("Invalid portfolio id"),

  body("title")
    .optional()

    .trim()

    .isLength({
      min: 5,
      max: 100,
    })

    .withMessage("Invalid title length"),

  body("description")
    .optional()

    .trim()

    .isLength({
      min: 50,
    })

    .withMessage("Description too short"),
];

/*
|--------------------------------------------------------------------------
| Portfolio ID Validation
|--------------------------------------------------------------------------
*/

const portfolioIdValidator = [
  param("id")
    .isMongoId()

    .withMessage("Invalid portfolio id"),
];

module.exports = {
  createPortfolioValidator,

  updatePortfolioValidator,

  portfolioIdValidator,
};

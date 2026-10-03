const portfolioService = require("../services/portfolio.service");

/**
 * @route POST /api/student/portfolio
 * @desc Create Portfolio
 * @access Student
 */
const createPortfolio = async (req, res, next) => {
  try {
    const portfolio = await portfolioService.createPortfolio(
      req.user.id,
      req.body,
    );

    return res.status(201).json({
      success: true,

      message: "Portfolio created successfully",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/student/portfolio
 * @desc Get Student Portfolio
 * @access Student
 */
const getMyPortfolio = async (req, res, next) => {
  try {
    const portfolio = await portfolioService.getMyPortfolio(req.user.id);

    return res.status(200).json({
      success: true,

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route PUT /api/student/portfolio/:id
 * @desc Update Portfolio
 * @access Student
 */
const updatePortfolio = async (req, res, next) => {
  try {
    const portfolio = await portfolioService.updatePortfolio(
      req.params.id,

      req.user.id,

      req.body,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio updated successfully",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route DELETE /api/student/portfolio/:id
 * @desc Delete Portfolio
 * @access Student
 */
const deletePortfolio = async (req, res, next) => {
  try {
    await portfolioService.deletePortfolio(
      req.params.id,

      req.user.id,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route PATCH /api/student/portfolio/:id/submit
 * @desc Submit Portfolio For Review
 * @access Student
 */
const submitPortfolio = async (req, res, next) => {
  try {
    const portfolio = await portfolioService.submitPortfolio(
      req.params.id,

      req.user.id,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio submitted for review",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

const getPublicPortfolios = async (req, res, next) => {
  try {
    const result = await portfolioService.getPublicPortfolios(req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPortfolio,

  getMyPortfolio,

  updatePortfolio,

  deletePortfolio,

  submitPortfolio,

  getPublicPortfolios,
};

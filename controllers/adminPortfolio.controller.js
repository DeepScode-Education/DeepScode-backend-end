const adminPortfolioService = require("../services/adminPortfolio.service");

/**
 * GET ALL PORTFOLIOS
 *
 * GET /api/admin/portfolio
 */
const getAllPortfolios = async (req, res, next) => {
  try {
    const result = await adminPortfolioService.getAllPortfolios(req.query);

    return res.status(200).json({
      success: true,

      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET SINGLE PORTFOLIO
 *
 * GET /api/admin/portfolio/:id
 */
const getPortfolioById = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.getPortfolioById(
      req.params.id,
    );

    return res.status(200).json({
      success: true,

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * UPDATE PORTFOLIO
 *
 * PUT /api/admin/portfolio/:id
 */
const updatePortfolio = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.updatePortfolio(
      req.params.id,

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
 * DELETE PORTFOLIO
 *
 * DELETE /api/admin/portfolio/:id
 */
const deletePortfolio = async (req, res, next) => {
  try {
    await adminPortfolioService.deletePortfolio(req.params.id);

    return res.status(200).json({
      success: true,

      message: "Portfolio deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * APPROVE PORTFOLIO
 *
 * PATCH /api/admin/portfolio/:id/approve
 */
const approvePortfolio = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.approvePortfolio(
      req.params.id,

      req.user.id,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio approved successfully",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * REJECT PORTFOLIO
 *
 * PATCH /api/admin/portfolio/:id/reject
 */
const rejectPortfolio = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.rejectPortfolio(
      req.params.id,

      req.body.remark,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio rejected",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * REQUEST CHANGES
 *
 * PATCH /api/admin/portfolio/:id/request-changes
 */
const requestChanges = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.requestChanges(
      req.params.id,

      req.body.remark,
    );

    return res.status(200).json({
      success: true,

      message: "Changes requested from student",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUBLISH PORTFOLIO
 *
 * PATCH /api/admin/portfolio/:id/publish
 */
const publishPortfolio = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.publishPortfolio(
      req.params.id,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio published successfully",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * UNPUBLISH PORTFOLIO
 *
 * PATCH /api/admin/portfolio/:id/unpublish
 */
const unpublishPortfolio = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.unpublishPortfolio(
      req.params.id,
    );

    return res.status(200).json({
      success: true,

      message: "Portfolio unpublished",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * FEATURE / UNFEATURE
 *
 * PATCH /api/admin/portfolio/:id/feature
 */
const toggleFeatured = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.toggleFeatured(req.params.id);

    return res.status(200).json({
      success: true,

      message: "Featured status updated",

      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};



const createExternalPortfolio = async (req, res, next) => {
  try {
    const portfolio = await adminPortfolioService.createExternalPortfolio(
      req.body,
      req.user.id,
    );

    return res.status(201).json({
      success: true,
      message:
        portfolio.status === "published"
          ? "External portfolio created and published successfully"
          : "External portfolio saved as draft",
      data: portfolio,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPortfolios,
  getPortfolioById,
  updatePortfolio,
  deletePortfolio,
  approvePortfolio,
  rejectPortfolio,
  requestChanges,
  publishPortfolio,
  unpublishPortfolio,
  toggleFeatured,
  createExternalPortfolio,
};

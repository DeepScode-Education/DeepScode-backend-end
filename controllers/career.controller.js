const { validationResult } = require("express-validator");
const careerService = require("../services/career.service");


const createCareer = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const career = await careerService.createCareer(
      req.body,
      req.user._id
    );

    return res.status(201).json({
      success: true,
      message: "Career created successfully",
      data: career,
    });
  } catch (error) {
    next(error);
  }
};


const getAdminCareers = async (req, res, next) => {
  try {
    const result = await careerService.getAdminCareers(req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};


const getCareerById = async (req, res, next) => {
  try {
    const career = await careerService.getCareerById(req.params.id);

    if (!career) {
      return res.status(404).json({
        success: false,
        message: "Career not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: career,
    });
  } catch (error) {
    next(error);
  }
};

const updateCareer = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const career = await careerService.updateCareer(
      req.params.id,
      req.body,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: "Career updated successfully",
      data: career,
    });
  } catch (error) {
    next(error);
  }
};


const deleteCareer = async (req, res, next) => {
  try {
    await careerService.deleteCareer(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Career deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


const updateCareerStatus = async (req, res, next) => {
  try {
    const career = await careerService.updateStatus(
      req.params.id,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Career status updated",
      data: career,
    });
  } catch (error) {
    next(error);
  }
};


const getPublishedCareers = async (req, res, next) => {
  try {
    const careers = await careerService.getPublishedCareers();

    return res.status(200).json({
      success: true,
      count: careers.length,
      data: careers,
    });
  } catch (error) {
    next(error);
  }
};


const getCareerBySlug = async (req, res, next) => {
  try {
    const career = await careerService.getCareerBySlug(req.params.slug);

    if (!career) {
      return res.status(404).json({
        success: false,
        message: "Career not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: career,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCareer,
  getAdminCareers,
  getCareerById,
  updateCareer,
  deleteCareer,
  updateCareerStatus,
  getPublishedCareers,
  getCareerBySlug,
};
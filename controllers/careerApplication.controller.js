const { validationResult } = require("express-validator");

const careerApplicationService = require("../services/careerApplication.service");
const uploadResumeToCloudinary = require("../utils/uploadResumeToCloudinary");



const applyForCareer = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume is required.",
      });
    }

    // Upload Resume to Cloudinary
    const uploadedResume = await uploadResumeToCloudinary(req.file);

    const application =
      await careerApplicationService.applyForCareer(
        req.params.careerId,
        req.body,
        {
          secure_url: uploadedResume.secure_url,
          public_id: uploadedResume.public_id,
          bytes: uploadedResume.bytes,
          originalname: req.file.originalname,
        },
        req.ip
      );

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};


const getApplications = async (req, res, next) => {
  try {
    const result =
      await careerApplicationService.getApplications(req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};


const getApplicationById = async (req, res, next) => {
  try {
    const application =
      await careerApplicationService.getApplicationById(
        req.params.id
      );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};



const updateApplicationStatus = async (
  req,
  res,
  next
) => {
  try {
    const application =
      await careerApplicationService.updateApplicationStatus(
        req.params.id,
        req.body.status,
        req.body.adminRemarks
      );

    return res.status(200).json({
      success: true,
      message: "Application status updated.",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};



const deleteApplication = async (
  req,
  res,
  next
) => {
  try {
    await careerApplicationService.deleteApplication(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Application deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};



const getDashboardStats = async (
  req,
  res,
  next
) => {
  try {
    const stats =
      await careerApplicationService.getDashboardStats();

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyForCareer,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getDashboardStats,
};
const testimonialService = require("../services/testimonial.service");

const uploadTestimonialImage = require("../utils/uploadTestimonialImage");

const uploadTestimonialVideo = require("../utils/uploadTestimonialVideo");

const deleteCloudinaryFile = require("../utils/deleteCloudinaryFile");

/*
|--------------------------------------------------------------------------
| CREATE TESTIMONIAL
|--------------------------------------------------------------------------
*/

const createTestimonial = async (req, res, next) => {
  try {
    let image = null;

    let video = null;

    // IMAGE UPLOAD

    if (req.files?.image) {
      const uploadedImage = await uploadTestimonialImage(
        req.files.image[0].buffer,
      );

      image = {
        url: uploadedImage.secure_url,

        publicId: uploadedImage.public_id,
      };
    }

    // VIDEO UPLOAD

    if (req.files?.video) {
      const uploadedVideo = await uploadTestimonialVideo(
        req.files.video[0].buffer,
      );

      video = {
        url: uploadedVideo.secure_url,

        publicId: uploadedVideo.public_id,
      };
    }

    const testimonial = await testimonialService.createTestimonial(
      {
        ...req.body,

        image,

        video,
      },

      req.user._id,
    );

    res.status(201).json({
      success: true,

      message: "Testimonial created successfully",

      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN GET ALL
|--------------------------------------------------------------------------
*/

const getAdminTestimonials = async (req, res, next) => {
  try {
    const result = await testimonialService.getAdminTestimonials(req.query);

    res.status(200).json({
      success: true,

      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| PUBLIC GET
|--------------------------------------------------------------------------
*/

const getPublicTestimonials = async (req, res, next) => {
  try {
    const testimonials = await testimonialService.getPublicTestimonials();

    res.status(200).json({
      success: true,

      data: testimonials,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| GET SINGLE
|--------------------------------------------------------------------------
*/

const getTestimonialById = async (req, res, next) => {
  try {
    const testimonial = await testimonialService.getTestimonialById(
      req.params.id,
    );

    if (!testimonial) {
      return res.status(404).json({
        success: false,

        message: "Testimonial not found",
      });
    }

    res.status(200).json({
      success: true,

      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE TESTIMONIAL
|--------------------------------------------------------------------------
*/

const updateTestimonial = async (req, res, next) => {
  try {
    const existing = await testimonialService.getTestimonialById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,

        message: "Testimonial not found",
      });
    }

    let image = existing.image;

    let video = existing.video;

    // NEW IMAGE

    if (req.files?.image) {
      if (existing.image?.publicId) {
        await deleteCloudinaryFile(existing.image.publicId);
      }

      const uploadedImage = await uploadTestimonialImage(
        req.files.image[0].buffer,
      );

      image = {
        url: uploadedImage.secure_url,

        publicId: uploadedImage.public_id,
      };
    }

    // NEW VIDEO

    if (req.files?.video) {
      if (existing.video?.publicId) {
        await deleteCloudinaryFile(existing.video.publicId);
      }

      const uploadedVideo = await uploadTestimonialVideo(
        req.files.video[0].buffer,
      );

      video = {
        url: uploadedVideo.secure_url,

        publicId: uploadedVideo.public_id,
      };
    }

    const testimonial = await testimonialService.updateTestimonial(
      req.params.id,

      {
        ...req.body,

        image,

        video,
      },

      req.user._id,
    );

    res.status(200).json({
      success: true,

      message: "Testimonial updated successfully",

      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

const deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await testimonialService.getTestimonialById(
      req.params.id,
    );

    if (testimonial?.image?.publicId) {
      await deleteCloudinaryFile(testimonial.image.publicId);
    }

    if (testimonial?.video?.publicId) {
      await deleteCloudinaryFile(testimonial.video.publicId);
    }

    await testimonialService.deleteTestimonial(req.params.id);

    res.status(200).json({
      success: true,

      message: "Testimonial deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

const updateTestimonialStatus = async (req, res, next) => {
  try {
    const testimonial = await testimonialService.updateStatus(
      req.params.id,

      req.body.isActive,
    );

    res.status(200).json({
      success: true,

      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| ORDER
|--------------------------------------------------------------------------
*/

const updateTestimonialOrder = async (req, res, next) => {
  try {
    const testimonial = await testimonialService.updateOrder(
      req.params.id,

      req.body.displayOrder,
    );

    res.status(200).json({
      success: true,

      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTestimonial,

  getAdminTestimonials,

  getPublicTestimonials,

  getTestimonialById,

  updateTestimonial,

  deleteTestimonial,

  updateTestimonialStatus,

  updateTestimonialOrder,
};

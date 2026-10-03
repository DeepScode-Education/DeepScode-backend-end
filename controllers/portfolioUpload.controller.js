// controllers/portfolioUpload.controller.js
//
// Signed, server-side Cloudinary upload for Portfolio thumbnail/gallery
// images. Works with the memoryStorage multer middleware you already have
// (middleware/uploadPortfolio.middleware.js) — req.file.buffer is uploaded
// straight to Cloudinary using your existing CLOUDINARY_* env vars, no
// unsigned preset needed.

const cloudinary = require("../config/Cloudinary");

const uploadBufferToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    uploadStream.end(buffer);
  });
};

/**
 * @route POST /api/student/portfolio/upload
 * @desc Upload a single thumbnail/gallery image (or video) to Cloudinary
 * @access Student
 * @body multipart/form-data, field name: "file"
 */
const uploadPortfolioImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const isVideo = req.file.mimetype.startsWith("video/");

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "deepScode/portfolio",
      resource_type: isVideo ? "video" : "image",
    });

    return res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadPortfolioImage,
};
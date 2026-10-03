const multer = require("multer");

// Memory Storage
// File server par save nahi hogi
// Direct Cloudinary jayegi

const storage = multer.memoryStorage();

// Allowed File Types

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",

    "image/png",

    "image/webp",

    "video/mp4",

    "video/webm",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP, MP4 files are allowed"), false);
  }
};

const uploadPortfolio = multer({
  storage,

  fileFilter,

  limits: {
    // 10 MB

    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadPortfolio;

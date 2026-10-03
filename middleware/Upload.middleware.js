const multer = require("multer");

// Memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",

      "image/png",

      "image/webp",

      "video/mp4",

      "video/webm",

      "video/quicktime",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"), false);
    }
  },
});

module.exports = upload;

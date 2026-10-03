// middleware/videoUpload.middleware.js
//
// Memory-storage multer config for mentor video uploads — mirrors the
// pattern already used by assignmentUpload.middleware.js /
// courseUpload.middleware.js (memoryStorage + fileFilter + Multer error
// handler), just scoped to video files headed for Google Drive instead of
// Cloudinary.

const multer = require("multer");

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const MAX_SIZE_MB = parseInt(process.env.VIDEO_MAX_SIZE_MB, 10) || 500;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only MP4, WebM, or MOV video files are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

const videoUpload = upload.single("video");

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: `Video exceeds the maximum allowed size of ${MAX_SIZE_MB} MB.`,
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.message?.includes("Only MP4")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
};

module.exports = { videoUpload, handleUploadError, MAX_SIZE_BYTES };
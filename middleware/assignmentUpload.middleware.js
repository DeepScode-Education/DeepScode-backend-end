// middleware/assignmentUpload.middleware.js
const multer = require("multer");

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream", // .fig, .blend etc often arrive as this
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        "File type not allowed. Use PDF, ZIP, PNG, JPG or design files.",
      ),
      false,
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // 50MB per file, max 10 files
});

const assignmentUpload = upload.array("files", 10);

const handleUploadError = (err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err.message?.includes("not allowed")
  ) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
};

module.exports = { assignmentUpload, handleUploadError };

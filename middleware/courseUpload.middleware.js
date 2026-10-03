
const multer = require("multer");

const ALLOWED_IMAGES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_PDFS   = ["application/pdf"];
const ALLOWED_VIDEOS = ["video/mp4", "video/quicktime", "video/x-msvideo"];

const ALL_ALLOWED = [...ALLOWED_IMAGES, ...ALLOWED_PDFS, ...ALLOWED_VIDEOS];

const IMAGE_MAX_MB = 5;
const PDF_MAX_MB   = 20;
const VIDEO_MAX_MB = 200;

const fileFilter = (req, file, cb) => {
  if (!ALL_ALLOWED.includes(file.mimetype)) {
    return cb(
      new Error(
        `File type not allowed: ${file.mimetype}. ` +
        `Allowed: JPG, PNG, WEBP (images), PDF, MP4 (video).`
      ),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage   : multer.memoryStorage(),
  fileFilter,
  limits    : { fileSize: VIDEO_MAX_MB * 1024 * 1024 }, // outer ceiling = 200 MB
});

/**
 * Accepts all course asset fields in a single multipart request.
 * Admin form sends any of:
 *   thumbnail, bannerImage, syllabusPdf, brochurePdf, promoVideo, roadmapPdf
 */
const courseUpload = upload.fields([
  { name: "thumbnail",   maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
  { name: "syllabusPdf", maxCount: 1 },
  { name: "brochurePdf", maxCount: 1 },
  { name: "promoVideo",  maxCount: 1 },
  { name: "roadmapPdf",  maxCount: 1 },  // ← NEW
]);

/**
 * Express error handler for Multer errors.
 * Attach AFTER courseUpload in the route chain.
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes("File type not allowed")) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
};

/**
 * Manual per-file size validation (called inside the service).
 * Returns an error string or null.
 */
const validateFileSizes = (files = {}) => {
  const { thumbnail, bannerImage, syllabusPdf, brochurePdf, roadmapPdf } = files;

  const check = (fileArr, label, maxMB, allowed) => {
    if (!fileArr?.[0]) return null;
    const f = fileArr[0];
    if (!allowed.includes(f.mimetype))
      return `${label}: invalid file type (${f.mimetype})`;
    if (f.size > maxMB * 1024 * 1024)
      return `${label}: max ${maxMB} MB allowed`;
    return null;
  };

  return (
    check(thumbnail,   "Thumbnail",         IMAGE_MAX_MB, ALLOWED_IMAGES) ||
    check(bannerImage, "Banner image",      IMAGE_MAX_MB, ALLOWED_IMAGES) ||
    check(syllabusPdf, "Syllabus PDF",      PDF_MAX_MB,   ALLOWED_PDFS)   ||
    check(brochurePdf, "Brochure PDF",      PDF_MAX_MB,   ALLOWED_PDFS)   ||
    check(roadmapPdf,  "Roadmap level PDF", PDF_MAX_MB,   ALLOWED_PDFS)   ||  // ← NEW
    null
  );
};

module.exports = { courseUpload, handleUploadError, validateFileSizes };
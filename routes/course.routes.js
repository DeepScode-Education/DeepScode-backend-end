
const express = require("express");
const router  = express.Router();
const parseCourseFields = require("../middleware/parseCourseFields.middleware");

const { auth, isAdmin } = require("../middleware/auth.middleware");

const {
  getCourses,
  getCourseBySlug,
  getAdminCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  featureCourse,
  reorderCourse,
  updateCourseStats,      // NEW
  updateCoursePlacement,  // NEW
} = require("../controllers/course.controller");

const { courseUpload, handleUploadError } = require("../middleware/courseUpload.middleware");

const {
  createCourseRules,
  updateCourseRules,
  getCourseListRules,
  updateStatsRules,       // NEW
  updatePlacementRules,   // NEW
  validate,
} = require("../validators/Course.validator");

const cloudinary = require("../config/Cloudinary");
const Course     = require("../models/Course");
const mongoose   = require("mongoose");

// ── Centralized error handling helpers ─────────────────────────────────────────
const catchAsync = require("../utils/catchAsync");
const {
  ValidationError,
  NotFoundError,
  FileUploadError,
  CloudinaryError,
} = require("../utils/errors/errorTypes");

// ─── Public routes ─────────────────────────────────────────────────────────────
router.get("/",      getCourseListRules, validate, getCourses);
router.get("/:slug", getCourseBySlug);

// ─── Cloudinary upload helper (wrapped so failures become a CloudinaryError) ───
const uploadRawToCloudinary = (buffer, folder, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "raw", ...(publicId ? { public_id: publicId } : {}) },
      (err, result) => {
        if (err) return reject(new CloudinaryError("Failed to upload the PDF to media storage.", { originalMessage: err.message }));
        resolve(result);
      }
    );
    stream.end(buffer);
  });

// ─── Generic PDF upload (auth required) ───────────────────────────────────────
router.post(
  "/upload/pdf",
  auth,
  courseUpload,
  handleUploadError,
  catchAsync(async (req, res) => {
    const file = req.files?.syllabusPdf?.[0];
    if (!file) {
      throw new FileUploadError("No PDF file was received. Attach a file under the field name 'syllabusPdf'.");
    }

    const result = await uploadRawToCloudinary(file.buffer, "deepScode/courses/pdfs");
    return res.json({ success: true, url: result.secure_url });
  })
);

// ─── Admin routes ─────────────────────────────────────────────────────────────
const adminRouter = express.Router();

// ── Existing CRUD ──────────────────────────────────────────────────────────────
adminRouter.get(   "/",            auth, isAdmin, getAdminCourses);
// adminRouter.post(  "/",            auth, isAdmin, courseUpload, handleUploadError, createCourseRules, validate, createCourse,  parseCourseFields);
adminRouter.post(
  "/",
  auth,
  isAdmin,
  courseUpload,
  handleUploadError,
  parseCourseFields,
  createCourseRules,
  validate,
  createCourse
);
// adminRouter.put(   "/:id",         auth, isAdmin, courseUpload, handleUploadError, updateCourseRules, validate, updateCourse ,   parseCourseFields);
adminRouter.put(
  "/:id",
  auth,
  isAdmin,
  courseUpload,
  handleUploadError,
  parseCourseFields,
  updateCourseRules,
  validate,
  updateCourse
);
adminRouter.delete("/:id",         auth, isAdmin, deleteCourse);
adminRouter.patch( "/:id/publish", auth, isAdmin, publishCourse);
adminRouter.patch( "/:id/feature", auth, isAdmin, featureCourse);
adminRouter.patch( "/:id/order",   auth, isAdmin, reorderCourse);

// ── NEW: Stats & placement ─────────────────────────────────────────────────────
/**
 * PATCH /api/admin/courses/:id/stats
 * Update denormalised stats (rating, studentCount, projectCount, reviewCount).
 */
adminRouter.patch("/:id/stats",     auth, isAdmin, updateStatsRules,     validate, updateCourseStats);

/**
 * PATCH /api/admin/courses/:id/placement
 * Update placement flags (hasCertificate, hasPlacementSupport, hiringPartners).
 */
adminRouter.patch("/:id/placement", auth, isAdmin, updatePlacementRules, validate, updateCoursePlacement);

// ── Roadmap PDF upload ─────────────────────────────────────────────────────────
// This is the route that was throwing a bare "Internal Server Error" (500)
// with no useful detail. It now:
//   - validates the course ID and level index with clear 400 messages
//   - throws NotFoundError (404) if the course or level doesn't exist
//   - throws FileUploadError (400) for bad file type / missing file / too large
//   - throws CloudinaryError (502) if the actual upload to Cloudinary fails
//   - lets any other unexpected error fall through to the centralized handler,
//     which logs the FULL stack trace to the terminal + logs/error.log
adminRouter.post(
  "/:id/roadmap/:index/pdf",
  auth,
  isAdmin,
  courseUpload,
  handleUploadError,
  catchAsync(async (req, res) => {
    const { id, index } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid course ID.", { field: "id", value: id });
    }

    const levelIndex = parseInt(index, 10);
    if (isNaN(levelIndex) || levelIndex < 0) {
      throw new ValidationError("The roadmap level index must be a non-negative number.", { field: "index", value: index });
    }

    const course = await Course.findById(id);
    if (!course) {
      throw new NotFoundError(`No course was found with ID "${id}".`);
    }

    if (!course.roadmap || levelIndex >= course.roadmap.length) {
      throw new ValidationError(
        `Roadmap level ${levelIndex + 1} does not exist. This course only has ${course.roadmap?.length ?? 0} level(s) — save the level first, then upload its PDF.`,
        { field: "index", levelIndex, availableLevels: course.roadmap?.length ?? 0 }
      );
    }

    const file = req.files?.roadmapPdf?.[0] || req.files?.syllabusPdf?.[0];
    if (!file) {
      throw new FileUploadError("No PDF file was received. Attach a file under the field name 'roadmapPdf'.");
    }
    if (file.mimetype !== "application/pdf") {
      throw new FileUploadError(`Only PDF files are allowed for the roadmap CTA. You uploaded a "${file.mimetype}" file.`, {
        receivedType: file.mimetype,
      });
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new FileUploadError(
        `This PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum allowed size is 20 MB.`,
        { sizeBytes: file.size, maxBytes: 20 * 1024 * 1024 }
      );
    }

    const cloudinaryResult = await uploadRawToCloudinary(
      file.buffer,
      "deepScode/courses/roadmap-pdfs",
      `${id}-level-${levelIndex}-${Date.now()}`
    );

    course.roadmap[levelIndex].ctaFileUrl = cloudinaryResult.secure_url;
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Roadmap level ${levelIndex + 1} PDF updated successfully.`,
      url: cloudinaryResult.secure_url,
      roadmap: course.roadmap,
    });
  })
);

// ── Roadmap PDF delete ─────────────────────────────────────────────────────────
adminRouter.delete(
  "/:id/roadmap/:index/pdf",
  auth,
  isAdmin,
  catchAsync(async (req, res) => {
    const { id, index } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Invalid course ID.", { field: "id", value: id });
    }

    const levelIndex = parseInt(index, 10);
    if (isNaN(levelIndex) || levelIndex < 0) {
      throw new ValidationError("The roadmap level index must be a non-negative number.", { field: "index", value: index });
    }

    const course = await Course.findById(id);
    if (!course) {
      throw new NotFoundError(`No course was found with ID "${id}".`);
    }

    if (!course.roadmap || levelIndex >= course.roadmap.length) {
      throw new ValidationError(`Roadmap level ${levelIndex + 1} does not exist on this course.`, {
        field: "index",
        levelIndex,
        availableLevels: course.roadmap?.length ?? 0,
      });
    }

    course.roadmap[levelIndex].ctaFileUrl = null;
    await course.save();

    return res.status(200).json({
      success: true,
      message: `Roadmap level ${levelIndex + 1} PDF removed.`,
      roadmap: course.roadmap,
    });
  })
);

module.exports = { publicRouter: router, adminRouter };
// const mongoose   = require("mongoose");
// const Course     = require("../models/Course");
// const cloudinary = require("../config/Cloudinary");
// const { buildPagination } = require("../utils/apiResponse");

// const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// const sendSuccess = (res, code, message, data = null, meta = {}) => {
//   const body = { success: true, message, ...meta };
//   if (data !== null) body.data = data;
//   return res.status(code).json(body);
// };

// const sendError = (res, code, message) =>
//   res.status(code).json({ success: false, message });

// // ─── Cloudinary buffer upload helper ──────────────────────────────────────────
// const uploadBufferToCloudinary = (buffer, folder, resourceType = "image") =>
//   new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder, resource_type: resourceType },
//       (err, result) => (err ? reject(err) : resolve(result))
//     );
//     stream.end(buffer);
//   });

// // ─── Process all uploaded files → Cloudinary URLs ─────────────────────────────
// const processUploadedFiles = async (files = {}) => {
//   const urls = {};

//   if (files.thumbnail?.[0]) {
//     const r = await uploadBufferToCloudinary(
//       files.thumbnail[0].buffer, "slate-academy/courses/thumbnails", "image"
//     );
//     urls.thumbnail = r.secure_url;
//   }
//   if (files.bannerImage?.[0]) {
//     const r = await uploadBufferToCloudinary(
//       files.bannerImage[0].buffer, "slate-academy/courses/banners", "image"
//     );
//     urls.bannerImage = r.secure_url;
//   }
//   if (files.syllabusPdf?.[0]) {
//     const r = await uploadBufferToCloudinary(
//       files.syllabusPdf[0].buffer, "slate-academy/courses/pdfs", "raw"
//     );
//     urls["downloads.syllabusPdf"] = r.secure_url;
//   }
//   if (files.brochurePdf?.[0]) {
//     const r = await uploadBufferToCloudinary(
//       files.brochurePdf[0].buffer, "slate-academy/courses/pdfs", "raw"
//     );
//     urls["downloads.brochurePdf"] = r.secure_url;
//   }
//   if (files.promoVideo?.[0]) {
//     const r = await uploadBufferToCloudinary(
//       files.promoVideo[0].buffer, "slate-academy/courses/videos", "video"
//     );
//     urls.promoVideo = r.secure_url;
//   }

//   return urls;
// };

// // ─── Parse JSON string fields from multipart/form-data body ───────────────────
// const parseJsonFields = (body) => {
//   const JSON_FIELDS = [
//     "roadmap", "portfolioProjects", "faqs",
//     "highlights", "whatsIncluded", "toolsCovered",
//     "learningOutcomes", "careerOpportunities",
//     "certification", "pricing", "seo", "publishing", "downloads",
//     "stats", "placement",  // NEW
//   ];
//   JSON_FIELDS.forEach((key) => {
//     if (typeof body[key] === "string") {
//       try { body[key] = JSON.parse(body[key]); } catch (_) {}
//     }
//   });
// };

// // ─── Build the duration-weeks filter ──────────────────────────────────────────
// // Maps the frontend "0-4 weeks" / "5-8 weeks" / "9+ weeks" to a MongoDB range.
// const durationWeeksFilter = (durationRange) => {
//   switch (durationRange) {
//     case "0-4 weeks": return { durationWeeks: { $gte: 0, $lte: 4 } };
//     case "5-8 weeks": return { durationWeeks: { $gte: 5, $lte: 8 } };
//     case "9+ weeks" : return { durationWeeks: { $gte: 9 } };
//     default         : return {};
//   }
// };

// // ─── PUBLIC ───────────────────────────────────────────────────────────────────

// /**
//  * GET /api/courses
//  *
//  * New query params (all optional, backward-compatible):
//  *   mode         – "Online" | "Offline" | "Hybrid"
//  *   schedule     – "Weekday" | "Weekend" | "Flexible"
//  *   durationRange – "0-4 weeks" | "5-8 weeks" | "9+ weeks"
//  *   hasCertificate        – "true"
//  *   hasPlacementSupport   – "true"
//  *   sort         – added "rating" | "popular" options
//  */
// const getCourses = async (req, res) => {
//   try {
//     const {
//       category, level, featured, search,
//       mode, schedule, durationRange,
//       hasCertificate, hasPlacementSupport,
//       page  = 1,
//       limit = 100,
//       sort  = "-createdAt",
//     } = req.query;

//     // ── Base filter: published only ──────────────────────────────────────────
//     const filter = {
//       $or: [
//         { "publishing.isPublished": true },
//         { isPublished: true },
//       ],
//     };

//     // ── Existing filters ─────────────────────────────────────────────────────
//     if (category && category.toLowerCase() !== "all") filter.category = category;
//     if (level    && level.toLowerCase()    !== "all") filter.level    = level;
//     if (featured === "true") filter["publishing.isFeatured"] = true;
//     if (search?.trim())      filter.title = { $regex: search.trim(), $options: "i" };

//     // ── NEW filters ──────────────────────────────────────────────────────────
//     if (mode     && mode     !== "Any") filter.mode     = mode;
//     if (schedule && schedule !== "Any") filter.schedule = schedule;

//     if (durationRange && durationRange !== "Any") {
//       Object.assign(filter, durationWeeksFilter(durationRange));
//     }

//     if (hasCertificate      === "true") filter["placement.hasCertificate"]      = true;
//     if (hasPlacementSupport === "true") filter["placement.hasPlacementSupport"] = true;

//     // ── Pagination ───────────────────────────────────────────────────────────
//     const pageNum  = Math.max(1, parseInt(page,  10) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));
//     const skip     = (pageNum - 1) * limitNum;

//     // ── Sort ─────────────────────────────────────────────────────────────────
//     const sortMap = {
//       "createdAt"    : { createdAt: 1 },
//       "-createdAt"   : { createdAt: -1 },
//       "displayOrder" : { "publishing.displayOrder": 1 },
//       "title"        : { title: 1 },
//       "rating"       : { "stats.rating": -1 },        // NEW
//       "popular"      : { "stats.studentCount": -1 },  // NEW
//     };
//     const sortObj = sortMap[sort] || { createdAt: -1 };

//     // ── Projection — card fields + new stats & placement flags ───────────────
//     const projection = {
//       title           : 1,
//       slug            : 1,
//       shortDescription: 1,
//       thumbnail       : 1,
//       category        : 1,
//       duration        : 1,
//       durationWeeks   : 1,   // NEW
//       level           : 1,
//       tag             : 1,
//       mode            : 1,   // NEW
//       schedule        : 1,   // NEW
//       toolsCovered    : 1,   // NEW — needed for tool chip pills on card
//       careerOpportunities: 1, // NEW — career outcomes section on card
//       publishing      : 1,
//       pricing         : 1,
//       stats           : 1,   // NEW — rating, studentCount, projectCount
//       placement       : 1,   // NEW — hasCertificate, hasPlacementSupport
//     };

//     const [courses, total] = await Promise.all([
//       Course.find(filter, projection).sort(sortObj).skip(skip).limit(limitNum).lean(),
//       Course.countDocuments(filter),
//     ]);

//     return sendSuccess(res, 200, "Courses fetched successfully", courses, {
//       pagination: buildPagination(total, pageNum, limitNum),
//     });
//   } catch (err) {
//     console.error("[getCourses] FULL ERROR:", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const getCourseBySlug = async (req, res) => {
//   try {
//     const { slug } = req.params;
//     const course = await Course.findOne({
//       slug,
//       $or: [
//         { "publishing.isPublished": true },
//         { isPublished: true },
//       ],
//     }).lean();

//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Course fetched successfully", course);
//   } catch (err) {
//     console.error("[getCourseBySlug]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// // ─── ADMIN ────────────────────────────────────────────────────────────────────

// const getAdminCourses = async (req, res) => {
//   try {
//     const {
//       page = 1, limit = 20, sort = "-createdAt",
//       search, category, level,
//     } = req.query;

//     const filter = {};
//     if (category)      filter.category = category;
//     if (level)         filter.level    = level;
//     if (search?.trim()) filter.title   = { $regex: search.trim(), $options: "i" };

//     const pageNum  = Math.max(1, parseInt(page,  10) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
//     const skip     = (pageNum - 1) * limitNum;

//     const [courses, total] = await Promise.all([
//       Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
//       Course.countDocuments(filter),
//     ]);

//     return sendSuccess(res, 200, "Courses fetched", courses, {
//       pagination: buildPagination(total, pageNum, limitNum),
//     });
//   } catch (err) {
//     console.error("[getAdminCourses]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const createCourse = async (req, res) => {
//   try {
//     const body = { ...req.body };
//     parseJsonFields(body);

//     const uploadedUrls = await processUploadedFiles(req.files || {});
//     Object.assign(body, uploadedUrls);

//     if (!body.slug && body.title) {
//       body.slug = body.title
//         .toLowerCase()
//         .replace(/[^a-z0-9\s-]/g, "")
//         .replace(/\s+/g, "-")
//         .replace(/-+/g, "-");

//       const exists = await Course.findOne({ slug: body.slug }).select("_id").lean();
//       if (exists) body.slug = `${body.slug}-${Date.now()}`;
//     }

//     body.createdBy = req.user?.id;

//     const course = await Course.create(body);
//     return sendSuccess(res, 201, "Course created successfully", course);
//   } catch (err) {
//     console.error("[createCourse]", err);
//     if (err.code === 11000)
//       return sendError(res, 409, "Slug already in use — choose a different title or slug");
//     if (err.name === "ValidationError") {
//       const msg = Object.values(err.errors).map((e) => e.message).join(". ");
//       return sendError(res, 400, msg);
//     }
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const updateCourse = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");

//     const body = { ...req.body };
//     parseJsonFields(body);

//     const uploadedUrls = await processUploadedFiles(req.files || {});
//     Object.assign(body, uploadedUrls);

//     body.updatedBy = req.user?.id;

//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       { $set: body },
//       { new: true, runValidators: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Course updated successfully", course);
//   } catch (err) {
//     console.error("[updateCourse]", err);
//     if (err.code === 11000) return sendError(res, 409, "Slug already in use");
//     if (err.name === "ValidationError") {
//       const msg = Object.values(err.errors).map((e) => e.message).join(". ");
//       return sendError(res, 400, msg);
//     }
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const deleteCourse = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");

//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       {
//         isDeleted: true,
//         deletedAt: new Date(),
//         "publishing.isPublished": false,
//         isPublished: false,
//       },
//       { new: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Course deleted successfully");
//   } catch (err) {
//     console.error("[deleteCourse]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const publishCourse = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");
//     const val = Boolean(req.body.isPublished);
//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       { "publishing.isPublished": val, isPublished: val },
//       { new: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, val ? "Course published" : "Course unpublished", course);
//   } catch (err) {
//     console.error("[publishCourse]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const featureCourse = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");
//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       { "publishing.isFeatured": Boolean(req.body.isFeatured) },
//       { new: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Featured status updated", course);
//   } catch (err) {
//     console.error("[featureCourse]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// const reorderCourse = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");
//     const order = parseInt(req.body.displayOrder, 10);
//     if (isNaN(order) || order < 0)
//       return sendError(res, 400, "displayOrder must be a non-negative integer");

//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       { "publishing.displayOrder": order },
//       { new: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Display order updated", course);
//   } catch (err) {
//     console.error("[reorderCourse]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// // ─── NEW: Patch course stats (admin only) ────────────────────────────────────
// /**
//  * PATCH /api/admin/courses/:id/stats
//  * Body: { rating, reviewCount, studentCount, projectCount }
//  * Allows admins to update the denormalised stats block manually
//  * (or this can be called by a background aggregation job).
//  */
// const updateCourseStats = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");

//     const { rating, reviewCount, studentCount, projectCount } = req.body;
//     const patch = {};

//     if (rating       !== undefined) patch["stats.rating"]       = Math.min(5, Math.max(0, Number(rating)));
//     if (reviewCount  !== undefined) patch["stats.reviewCount"]  = Math.max(0, parseInt(reviewCount, 10));
//     if (studentCount !== undefined) patch["stats.studentCount"] = Math.max(0, parseInt(studentCount, 10));
//     if (projectCount !== undefined) patch["stats.projectCount"] = Math.max(0, parseInt(projectCount, 10));

//     if (!Object.keys(patch).length) return sendError(res, 400, "No valid stats fields provided");

//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       { $set: patch },
//       { new: true, runValidators: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Stats updated", { stats: course.stats });
//   } catch (err) {
//     console.error("[updateCourseStats]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// // ─── NEW: Patch placement flags (admin only) ─────────────────────────────────
// /**
//  * PATCH /api/admin/courses/:id/placement
//  * Body: { hasPlacementSupport, hasCertificate, hiringPartners }
//  */
// const updateCoursePlacement = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");

//     const { hasPlacementSupport, hasCertificate, hiringPartners } = req.body;
//     const patch = {};

//     if (hasPlacementSupport !== undefined) patch["placement.hasPlacementSupport"] = Boolean(hasPlacementSupport);
//     if (hasCertificate      !== undefined) patch["placement.hasCertificate"]      = Boolean(hasCertificate);
//     if (Array.isArray(hiringPartners))     patch["placement.hiringPartners"]      = hiringPartners;

//     if (!Object.keys(patch).length) return sendError(res, 400, "No valid placement fields provided");

//     const course = await Course.findByIdAndUpdate(
//       req.params.id,
//       { $set: patch },
//       { new: true }
//     );
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Placement info updated", { placement: course.placement });
//   } catch (err) {
//     console.error("[updateCoursePlacement]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// // ─── Backward compat ──────────────────────────────────────────────────────────
// const getCourseById = async (req, res) => {
//   try {
//     if (!isValidId(req.params.id)) return sendError(res, 400, "Invalid course ID");
//     const course = await Course.findById(req.params.id).lean();
//     if (!course) return sendError(res, 404, "Course not found");
//     return sendSuccess(res, 200, "Course fetched successfully", course);
//   } catch (err) {
//     console.error("[getCourseById]", err);
//     return sendError(res, 500, "Internal server error");
//   }
// };

// module.exports = {
//   getCourses,
//   getCourseBySlug,
//   getCourseById,
//   getAdminCourses,
//   createCourse,
//   updateCourse,
//   deleteCourse,
//   publishCourse,
//   featureCourse,
//   reorderCourse,
//   updateCourseStats,       // NEW
//   updateCoursePlacement,   // NEW
// };





const mongoose   = require("mongoose");
const Course     = require("../models/Course");
const cloudinary = require("../config/Cloudinary");
const { buildPagination } = require("../utils/apiResponse");

// ── Centralized error handling ─────────────────────────────────────────────────
const catchAsync = require("../utils/catchAsync");
const {
  ValidationError,
  NotFoundError,
  DuplicateError,
  CloudinaryError,
} = require("../utils/errors/errorTypes");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const sendSuccess = (res, code, message, data = null, meta = {}) => {
  const body = { success: true, message, ...meta };
  if (data !== null) body.data = data;
  return res.status(code).json(body);
};

// ─── Cloudinary buffer upload helper ──────────────────────────────────────────
// Any failure here is wrapped into a CloudinaryError (502) instead of bubbling
// up as an opaque exception, so the admin sees "the upload service failed"
// rather than a bare "Internal Server Error".
const uploadBufferToCloudinary = (buffer, folder, resourceType = "image") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) {
          return reject(
            new CloudinaryError(
              `Failed to upload ${resourceType === "raw" ? "file" : resourceType} to media storage. Please try again.`,
              { originalMessage: err.message, folder, resourceType }
            )
          );
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });

// ─── Process all uploaded files → Cloudinary URLs ─────────────────────────────
const processUploadedFiles = async (files = {}) => {
  const urls = {};

  if (files.thumbnail?.[0]) {
    const r = await uploadBufferToCloudinary(
      files.thumbnail[0].buffer, "deepScode/courses/thumbnails", "image"
    );
    urls.thumbnail = r.secure_url;
  }
  if (files.bannerImage?.[0]) {
    const r = await uploadBufferToCloudinary(
      files.bannerImage[0].buffer, "deepScode/courses/banners", "image"
    );
    urls.bannerImage = r.secure_url;
  }
  if (files.syllabusPdf?.[0]) {
    const r = await uploadBufferToCloudinary(
      files.syllabusPdf[0].buffer, "deepScode/courses/pdfs", "raw"
    );
    urls["downloads.syllabusPdf"] = r.secure_url;
  }
  if (files.brochurePdf?.[0]) {
    const r = await uploadBufferToCloudinary(
      files.brochurePdf[0].buffer, "deepScode/courses/pdfs", "raw"
    );
    urls["downloads.brochurePdf"] = r.secure_url;
  }
  if (files.promoVideo?.[0]) {
    const r = await uploadBufferToCloudinary(
      files.promoVideo[0].buffer, "deepScode/courses/videos", "video"
    );
    urls.promoVideo = r.secure_url;
  }

  return urls;
};

// ─── Parse JSON string fields from multipart/form-data body ───────────────────
const parseJsonFields = (body) => {
  const JSON_FIELDS = [
    "roadmap", "portfolioProjects", "faqs",
    "highlights", "whatsIncluded", "toolsCovered",
    "learningOutcomes", "careerOpportunities",
    "certification", "pricing", "seo", "publishing", "downloads",
    "stats", "placement",  // NEW
  ];
  const badFields = [];

  JSON_FIELDS.forEach((key) => {
    if (typeof body[key] === "string") {
      try {
        body[key] = JSON.parse(body[key]);
      } catch (_) {
        badFields.push(key);
      }
    }
  });

  // Surface malformed JSON as a clear validation error instead of silently
  // leaving the raw (unusable) string in place, which used to fail later
  // with a confusing Mongoose cast error.
  if (badFields.length) {
    throw new ValidationError(
      `The following fields contain invalid data and could not be read: ${badFields.join(", ")}.`,
      badFields.map((field) => ({ field, message: "Malformed JSON" }))
    );
  }
};

// ─── Build the duration-weeks filter ──────────────────────────────────────────
// Maps the frontend "0-4 weeks" / "5-8 weeks" / "9+ weeks" to a MongoDB range.
const durationWeeksFilter = (durationRange) => {
  switch (durationRange) {
    case "0-4 weeks": return { durationWeeks: { $gte: 0, $lte: 4 } };
    case "5-8 weeks": return { durationWeeks: { $gte: 5, $lte: 8 } };
    case "9+ weeks" : return { durationWeeks: { $gte: 9 } };
    default         : return {};
  }
};

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

/**
 * GET /api/courses
 *
 * New query params (all optional, backward-compatible):
 *   mode         – "Online" | "Offline" | "Hybrid"
 *   schedule     – "Weekday" | "Weekend" | "Flexible"
 *   durationRange – "0-4 weeks" | "5-8 weeks" | "9+ weeks"
 *   hasCertificate        – "true"
 *   hasPlacementSupport   – "true"
 *   sort         – added "rating" | "popular" options
 */
const getCourses = catchAsync(async (req, res) => {
  const {
    category, level, featured, search,
    mode, schedule, durationRange,
    hasCertificate, hasPlacementSupport,
    page  = 1,
    limit = 100,
    sort  = "-createdAt",
  } = req.query;

  // ── Base filter: published only ──────────────────────────────────────────
  const filter = {
    $or: [
      { "publishing.isPublished": true },
      { isPublished: true },
    ],
  };

  // ── Existing filters ─────────────────────────────────────────────────────
  if (category && category.toLowerCase() !== "all") filter.category = category;
  if (level    && level.toLowerCase()    !== "all") filter.level    = level;
  if (featured === "true") filter["publishing.isFeatured"] = true;
  if (search?.trim())      filter.title = { $regex: search.trim(), $options: "i" };

  // ── NEW filters ──────────────────────────────────────────────────────────
  if (mode     && mode     !== "Any") filter.mode     = mode;
  if (schedule && schedule !== "Any") filter.schedule = schedule;

  if (durationRange && durationRange !== "Any") {
    Object.assign(filter, durationWeeksFilter(durationRange));
  }

  if (hasCertificate      === "true") filter["placement.hasCertificate"]      = true;
  if (hasPlacementSupport === "true") filter["placement.hasPlacementSupport"] = true;

  // ── Pagination ───────────────────────────────────────────────────────────
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));
  const skip     = (pageNum - 1) * limitNum;

  // ── Sort ─────────────────────────────────────────────────────────────────
  const sortMap = {
    "createdAt"    : { createdAt: 1 },
    "-createdAt"   : { createdAt: -1 },
    "displayOrder" : { "publishing.displayOrder": 1 },
    "title"        : { title: 1 },
    "rating"       : { "stats.rating": -1 },        // NEW
    "popular"      : { "stats.studentCount": -1 },  // NEW
  };
  const sortObj = sortMap[sort] || { createdAt: -1 };

  // ── Projection — card fields + new stats & placement flags ───────────────
  const projection = {
    title           : 1,
    slug            : 1,
    shortDescription: 1,
    thumbnail       : 1,
    category        : 1,
    duration        : 1,
    durationWeeks   : 1,   // NEW
    level           : 1,
    tag             : 1,
    mode            : 1,   // NEW
    schedule        : 1,   // NEW
    toolsCovered    : 1,   // NEW — needed for tool chip pills on card
    careerOpportunities: 1, // NEW — career outcomes section on card
    publishing      : 1,
    pricing         : 1,
    stats           : 1,   // NEW — rating, studentCount, projectCount
    placement       : 1,   // NEW — hasCertificate, hasPlacementSupport
  };

  const [courses, total] = await Promise.all([
    Course.find(filter, projection).sort(sortObj).skip(skip).limit(limitNum).lean(),
    Course.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Courses fetched successfully", courses, {
    pagination: buildPagination(total, pageNum, limitNum),
  });
});

const getCourseBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const course = await Course.findOne({
    slug,
    $or: [
      { "publishing.isPublished": true },
      { isPublished: true },
    ],
  }).lean();

  if (!course) throw new NotFoundError(`No published course was found for "${slug}".`);
  return sendSuccess(res, 200, "Course fetched successfully", course);
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

const getAdminCourses = catchAsync(async (req, res) => {
  const {
    page = 1, limit = 20, sort = "-createdAt",
    search, category, level,
  } = req.query;

  const filter = {};
  if (category)      filter.category = category;
  if (level)         filter.level    = level;
  if (search?.trim()) filter.title   = { $regex: search.trim(), $options: "i" };

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const [courses, total] = await Promise.all([
    Course.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Course.countDocuments(filter),
  ]);

  return sendSuccess(res, 200, "Courses fetched", courses, {
    pagination: buildPagination(total, pageNum, limitNum),
  });
});

const createCourse = catchAsync(async (req, res) => {
  const body = { ...req.body };
  parseJsonFields(body);

  const uploadedUrls = await processUploadedFiles(req.files || {});
  Object.assign(body, uploadedUrls);

  if (!body.slug && body.title) {
    body.slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const exists = await Course.findOne({ slug: body.slug }).select("_id").lean();
    if (exists) body.slug = `${body.slug}-${Date.now()}`;
  }

  body.createdBy = req.user?.id;

  try {
    const course = await Course.create(body);
    return sendSuccess(res, 201, "Course created successfully", course);
  } catch (err) {
    if (err.code === 11000) {
      throw new DuplicateError("A course with this slug or title already exists — choose a different title or slug.");
    }
    // Anything else (including Mongoose ValidationError) is normalized by the
    // centralized error handler — no need to duplicate that logic here.
    throw err;
  }
});

const updateCourse = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });

  const body = { ...req.body };
  parseJsonFields(body);

  const uploadedUrls = await processUploadedFiles(req.files || {});
  Object.assign(body, uploadedUrls);

  body.updatedBy = req.user?.id;

  let course;
  try {
    course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      throw new DuplicateError("A course with this slug already exists.");
    }
    throw err;
  }

  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Course updated successfully", course);
});

const deleteCourse = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });

  const course = await Course.findByIdAndUpdate(
    req.params.id,
    {
      isDeleted: true,
      deletedAt: new Date(),
      "publishing.isPublished": false,
      isPublished: false,
    },
    { new: true }
  );
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Course deleted successfully");
});

const publishCourse = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });
  const val = Boolean(req.body.isPublished);
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { "publishing.isPublished": val, isPublished: val },
    { new: true }
  );
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, val ? "Course published" : "Course unpublished", course);
});

const featureCourse = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { "publishing.isFeatured": Boolean(req.body.isFeatured) },
    { new: true }
  );
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Featured status updated", course);
});

const reorderCourse = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });
  const order = parseInt(req.body.displayOrder, 10);
  if (isNaN(order) || order < 0) {
    throw new ValidationError("displayOrder must be a non-negative integer.", { field: "displayOrder", value: req.body.displayOrder });
  }

  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { "publishing.displayOrder": order },
    { new: true }
  );
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Display order updated", course);
});

// ─── Patch course stats (admin only) ──────────────────────────────────────────
/**
 * PATCH /api/admin/courses/:id/stats
 * Body: { rating, reviewCount, studentCount, projectCount }
 * Allows admins to update the denormalised stats block manually
 * (or this can be called by a background aggregation job).
 */
const updateCourseStats = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });

  const { rating, reviewCount, studentCount, projectCount } = req.body;
  const patch = {};

  if (rating       !== undefined) patch["stats.rating"]       = Math.min(5, Math.max(0, Number(rating)));
  if (reviewCount  !== undefined) patch["stats.reviewCount"]  = Math.max(0, parseInt(reviewCount, 10));
  if (studentCount !== undefined) patch["stats.studentCount"] = Math.max(0, parseInt(studentCount, 10));
  if (projectCount !== undefined) patch["stats.projectCount"] = Math.max(0, parseInt(projectCount, 10));

  if (!Object.keys(patch).length) {
    throw new ValidationError("No valid stats fields were provided. Expected at least one of: rating, reviewCount, studentCount, projectCount.");
  }

  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { $set: patch },
    { new: true, runValidators: true }
  );
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Stats updated", { stats: course.stats });
});

// ─── Patch placement flags (admin only) ───────────────────────────────────────
/**
 * PATCH /api/admin/courses/:id/placement
 * Body: { hasPlacementSupport, hasCertificate, hiringPartners }
 */
const updateCoursePlacement = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });

  const { hasPlacementSupport, hasCertificate, hiringPartners } = req.body;
  const patch = {};

  if (hasPlacementSupport !== undefined) patch["placement.hasPlacementSupport"] = Boolean(hasPlacementSupport);
  if (hasCertificate      !== undefined) patch["placement.hasCertificate"]      = Boolean(hasCertificate);
  if (Array.isArray(hiringPartners))     patch["placement.hiringPartners"]      = hiringPartners;

  if (!Object.keys(patch).length) {
    throw new ValidationError("No valid placement fields were provided. Expected at least one of: hasPlacementSupport, hasCertificate, hiringPartners.");
  }

  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { $set: patch },
    { new: true }
  );
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Placement info updated", { placement: course.placement });
});

// ─── Backward compat ──────────────────────────────────────────────────────────
const getCourseById = catchAsync(async (req, res) => {
  if (!isValidId(req.params.id)) throw new ValidationError("Invalid course ID.", { field: "id", value: req.params.id });
  const course = await Course.findById(req.params.id).lean();
  if (!course) throw new NotFoundError(`No course was found with ID "${req.params.id}".`);
  return sendSuccess(res, 200, "Course fetched successfully", course);
});

module.exports = {
  getCourses,
  getCourseBySlug,
  getCourseById,
  getAdminCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  featureCourse,
  reorderCourse,
  updateCourseStats,       // NEW
  updateCoursePlacement,   // NEW
};
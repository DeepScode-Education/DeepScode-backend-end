

const mongoose = require("mongoose");
const Course   = require("../models/Course");
const cloudinary = require("../config/Cloudinary");
const { generateUniqueSlug } = require("../utils/slugify");
const { buildPagination }    = require("../utils/apiResponse");

// ─── Cloudinary helpers ────────────────────────────────────────────────────────

/**
 * Stream a buffer (from multer memoryStorage) to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder   - e.g. "deepScode/courses/thumbnails"
 * @param {string} type     - "image" | "raw" (PDFs) | "video"
 */
const uploadBuffer = (buffer, folder, type = "image") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: type },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

/**
 * Extract Cloudinary uploads from req.files and return a flat object
 * of { fieldName: { url, publicId } }.  Only processes files that were
 * actually uploaded in this request.
 */
const processUploads = async (files = {}) => {
  const result = {};

  const upload = async (fileArr, field, folder, type) => {
    if (!fileArr?.[0]) return;
    const r = await uploadBuffer(fileArr[0].buffer, folder, type);
    result[field] = { url: r.secure_url, publicId: r.public_id };
  };

  await Promise.all([
    upload(files.thumbnail,   "thumbnail",   "deepScode/courses/thumbnails", "image"),
    upload(files.bannerImage, "bannerImage", "deepScode/courses/banners",    "image"),
    upload(files.syllabusPdf, "syllabusPdf", "deepScode/courses/pdfs",       "raw"),
    upload(files.brochurePdf, "brochurePdf", "deepScode/courses/pdfs",       "raw"),
    upload(files.promoVideo,  "promoVideo",  "deepScode/courses/videos",     "video"),
  ]);

  return result;
};

/**
 * Delete a Cloudinary asset by public_id.  Errors are swallowed so a
 * missing asset never blocks a create/update flow.
 */
const destroyAsset = (publicId, type = "image") =>
  cloudinary.uploader.destroy(publicId, { resource_type: type }).catch(() => {});

// ─── Build course payload from request body ────────────────────────────────────

const buildCoursePayload = (body, uploads = {}, userId = null) => {
  const payload = {};

  // Scalar fields
  const scalars = [
    "title", "shortDescription", "heroTitle", "heroDescription",
    "overview", "category", "level", "duration", "tag",
  ];
  scalars.forEach((k) => {
    if (body[k] !== undefined) payload[k] = typeof body[k] === "string" ? body[k].trim() : body[k];
  });

  // Slug — either from body or auto-generate later
  if (body.slug) payload.slug = body.slug;

  // Array fields
  const arrays = [
    "highlights", "whatsIncluded", "toolsCovered",
    "learningOutcomes", "careerOpportunities",
    "roadmap", "portfolioProjects", "faqs",
  ];
  arrays.forEach((k) => {
    if (body[k] !== undefined) {
      payload[k] = Array.isArray(body[k]) ? body[k] : JSON.parse(body[k]);
    }
  });

  // Nested objects (come as JSON strings from multipart/form-data)
  const nested = ["certification", "pricing", "seo", "publishing"];
  nested.forEach((k) => {
    if (body[k] !== undefined) {
      payload[k] = typeof body[k] === "string" ? JSON.parse(body[k]) : body[k];
    }
  });

  // Cloudinary URLs from processed uploads
  if (uploads.thumbnail)   payload.thumbnail  = uploads.thumbnail.url;
  if (uploads.bannerImage) payload.bannerImage = uploads.bannerImage.url;
  if (uploads.promoVideo)  payload.promoVideo  = uploads.promoVideo.url;

  if (uploads.syllabusPdf || uploads.brochurePdf) {
    payload.downloads = payload.downloads || {};
    if (uploads.syllabusPdf) payload.downloads.syllabusPdf = uploads.syllabusPdf.url;
    if (uploads.brochurePdf) payload.downloads.brochurePdf = uploads.brochurePdf.url;
  }

  if (userId) payload.createdBy = userId;

  return payload;
};

// ─── Public service methods ────────────────────────────────────────────────────

/**
 * GET /api/courses
 * Returns published courses with filtering, search, sorting and pagination.
 */
const getCourseList = async (query) => {
  const {
    category,
    level,
    featured,
    search,
    page    = 1,
    limit   = 12,
    sort    = "-createdAt",
  } = query;

  const filter = { "publishing.isPublished": true };

  if (category && category.toLowerCase() !== "all") filter.category = category;
  if (level    && level.toLowerCase()    !== "all") filter.level    = level;
  if (featured === "true" || featured === true)      filter["publishing.isFeatured"] = true;

  if (search?.trim()) {
    filter.$text = { $search: search.trim() };
  }

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
  const skip     = (pageNum - 1) * limitNum;

  // Build sort object
  const sortMap = {
    "createdAt"    : { createdAt: 1 },
    "-createdAt"   : { createdAt: -1 },
    "displayOrder" : { "publishing.displayOrder": 1 },
    "title"        : { title: 1 },
  };
  const sortObj = sortMap[sort] ?? { createdAt: -1 };

  // Listing projection — only fields the Course Card needs
  const projection = {
    title            : 1,
    slug             : 1,
    shortDescription : 1,
    thumbnail        : 1,
    category         : 1,
    duration         : 1,
    level            : 1,
    tag              : 1,
    "publishing.isFeatured"   : 1,
    "publishing.displayOrder" : 1,
    "publishing.isPublished"  : 1,
    "pricing.price"           : 1,
    "pricing.discountPrice"   : 1,
    "pricing.currency"        : 1,
  };

  const [courses, total] = await Promise.all([
    Course.find(filter, projection)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  return { courses, pagination: buildPagination(total, pageNum, limitNum) };
};

/**
 * GET /api/courses/:slug
 * Returns the full course detail for the public course page.
 */
const getCourseBySlug = async (slug) => {
  const course = await Course.findOne({
    slug,
    "publishing.isPublished": true,
  }).lean();

  return course;
};

// ─── Admin service methods ─────────────────────────────────────────────────────

/**
 * POST /api/admin/courses
 */
const createCourse = async (body, files, userId) => {
  const uploads = await processUploads(files);
  const payload = buildCoursePayload(body, uploads, userId);

  // Auto-generate slug if not supplied
  if (!payload.slug && payload.title) {
    payload.slug = await generateUniqueSlug(payload.title);
  } else if (payload.slug) {
    // Verify uniqueness of manually supplied slug
    const exists = await Course.findOne({ slug: payload.slug }).select("_id").lean();
    if (exists) throw Object.assign(new Error("Slug already in use"), { statusCode: 409 });
  }

  const course = await Course.create(payload);
  return course;
};

/**
 * PUT /api/admin/courses/:id
 */
const updateCourse = async (id, body, files, userId) => {
  const course = await Course.findById(id);
  if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });

  const uploads = await processUploads(files);
  const payload = buildCoursePayload(body, uploads);
  payload.updatedBy = userId;

  // Slug uniqueness — exclude the current doc
  if (payload.slug && payload.slug !== course.slug) {
    const exists = await Course.findOne({ slug: payload.slug, _id: { $ne: id } }).select("_id").lean();
    if (exists) throw Object.assign(new Error("Slug already in use"), { statusCode: 409 });
  } else if (!payload.slug && payload.title && payload.title !== course.title) {
    payload.slug = await generateUniqueSlug(payload.title, id);
  }

  const updated = await Course.findByIdAndUpdate(id, { $set: payload }, {
    new           : true,
    runValidators : true,
  });

  return updated;
};

/**
 * DELETE /api/admin/courses/:id  (soft delete)
 */
const deleteCourse = async (id) => {
  const course = await Course.findById(id);
  if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });

  await Course.findByIdAndUpdate(id, {
    isDeleted : true,
    deletedAt : new Date(),
    "publishing.isPublished" : false,
  });
};

/**
 * PATCH /api/admin/courses/:id/publish
 * Toggle or explicitly set isPublished.
 */
const setPublished = async (id, isPublished) => {
  const course = await Course.findByIdAndUpdate(
    id,
    { "publishing.isPublished": Boolean(isPublished) },
    { new: true, runValidators: true }
  );
  if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  return course;
};

/**
 * PATCH /api/admin/courses/:id/feature
 */
const setFeatured = async (id, isFeatured) => {
  const course = await Course.findByIdAndUpdate(
    id,
    { "publishing.isFeatured": Boolean(isFeatured) },
    { new: true, runValidators: true }
  );
  if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  return course;
};

/**
 * PATCH /api/admin/courses/:id/order
 */
const setDisplayOrder = async (id, order) => {
  const parsed = parseInt(order, 10);
  if (isNaN(parsed) || parsed < 0)
    throw Object.assign(new Error("displayOrder must be a non-negative integer"), { statusCode: 400 });

  const course = await Course.findByIdAndUpdate(
    id,
    { "publishing.displayOrder": parsed },
    { new: true, runValidators: true }
  );
  if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  return course;
};

/**
 * Admin course list — full details, includes unpublished.
 */
const getAdminCourseList = async (query) => {
  const {
    page  = 1,
    limit = 20,
    sort  = "-createdAt",
    search,
    category,
    level,
  } = query;

  const filter = {};
  if (category) filter.category = category;
  if (level)    filter.level    = level;
  if (search?.trim()) filter.$text = { $search: search.trim() };

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const sortMap = {
    "createdAt"  : { createdAt: 1 },
    "-createdAt" : { createdAt: -1 },
    "title"      : { title: 1 },
  };
  const sortObj = sortMap[sort] ?? { createdAt: -1 };

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  return { courses, pagination: buildPagination(total, pageNum, limitNum) };
};

module.exports = {
  getCourseList,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  setPublished,
  setFeatured,
  setDisplayOrder,
  getAdminCourseList,
};
const { body, param, query, validationResult } = require("express-validator");

const CATEGORIES = ["Design", "3D", "Marketing", "Data", "Tech"];
const LEVELS          = ["Beginner", "Intermediate", "Advanced"];
const CURRENCIES      = ["INR", "USD", "EUR"];
const MODES           = ["Online", "Offline", "Hybrid"];          // NEW
const SCHEDULES       = ["Weekday", "Weekend", "Flexible"];       // NEW
const DURATION_RANGES = ["0-4 weeks", "5-8 weeks", "9+ weeks"];  // NEW
const SORT_OPTIONS    = [
  "createdAt", "-createdAt",
  "displayOrder", "title",
  "rating", "popular",   // NEW
];

// ─── Reusable rule sets ────────────────────────────────────────────────────────

const titleRule = () =>
  body("title")
    .optional()
    .trim()
    .notEmpty().withMessage("Title cannot be blank")
    .isLength({ max: 150 }).withMessage("Title max 150 chars");

const slugRule = () =>
  body("slug")
    .optional()
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug: only lowercase letters, numbers, hyphens");

const categoryRule = (required = true) => {
  const r = body("category");
  const base = required ? r.notEmpty().withMessage("Category is required") : r.optional();
  return base.isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(", ")}`);
};

const levelRule = (required = true) => {
  const r = body("level");
  const base = required ? r.notEmpty().withMessage("Level is required") : r.optional();
  return base.isIn(LEVELS).withMessage(`Level must be one of: ${LEVELS.join(", ")}`);
};

// ─── Create course rules ───────────────────────────────────────────────────────
const createCourseRules = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 150 }).withMessage("Title max 150 chars"),

  slugRule(),
  categoryRule(true),
  levelRule(true),

  body("shortDescription").optional().trim().isLength({ max: 300 }).withMessage("Short description max 300 chars"),
  body("heroTitle").optional().trim(),
  body("heroDescription").optional().trim(),
  body("overview").optional().trim(),
  body("duration").optional().trim(),
  body("tag").optional().trim(),

  // NEW delivery fields
  body("mode")
    .optional()
    .isIn([...MODES, "", null]).withMessage(`Mode must be one of: ${MODES.join(", ")}`),
  body("schedule")
    .optional()
    .isIn([...SCHEDULES, "", null]).withMessage(`Schedule must be one of: ${SCHEDULES.join(", ")}`),
  body("durationWeeks")
    .optional()
    .isFloat({ min: 0 }).withMessage("durationWeeks must be a non-negative number"),

  // Arrays — must be arrays if present
  body("highlights").optional().isArray().withMessage("highlights must be an array"),
  body("whatsIncluded").optional().isArray(),
  body("toolsCovered").optional().isArray(),
  body("learningOutcomes").optional().isArray(),
  body("careerOpportunities").optional().isArray(),
  body("faqs").optional().isArray(),
  body("roadmap").optional().isArray(),
  body("portfolioProjects").optional().isArray(),

  // Pricing
  body("pricing.price").optional().isFloat({ min: 0 }).withMessage("Price must be >= 0"),
  body("pricing.discountPrice").optional().isFloat({ min: 0 }),
  body("pricing.currency").optional().isIn(CURRENCIES),

  // SEO
  body("seo.title").optional().trim().isLength({ max: 160 }),
  body("seo.description").optional().trim().isLength({ max: 320 }),
  body("seo.keywords").optional().isArray(),

  // Publishing
  body("publishing.isPublished").optional().isBoolean(),
  body("publishing.isFeatured").optional().isBoolean(),
  body("publishing.displayOrder").optional().isInt({ min: 0 }),

  // NEW: Stats
  body("stats.rating").optional().isFloat({ min: 0, max: 5 }),
  body("stats.reviewCount").optional().isInt({ min: 0 }),
  body("stats.studentCount").optional().isInt({ min: 0 }),
  body("stats.projectCount").optional().isInt({ min: 0 }),

  // NEW: Placement
  body("placement.hasPlacementSupport").optional().isBoolean(),
  body("placement.hasCertificate").optional().isBoolean(),
  body("placement.hiringPartners").optional().isArray(),
];

// ─── Update course rules (all optional) ───────────────────────────────────────
const updateCourseRules = [
  titleRule(),
  slugRule(),
  categoryRule(false),
  levelRule(false),

  body("shortDescription").optional().trim().isLength({ max: 300 }),

  // NEW delivery fields (also optional on update)
  body("mode").optional().isIn([...MODES, "", null]),
  body("schedule").optional().isIn([...SCHEDULES, "", null]),
  body("durationWeeks").optional().isFloat({ min: 0 }),

  body("pricing.price").optional().isFloat({ min: 0 }),
  body("pricing.currency").optional().isIn(CURRENCIES),

  body("seo.title").optional().trim().isLength({ max: 160 }),
  body("seo.description").optional().trim().isLength({ max: 320 }),

  body("publishing.isPublished").optional().isBoolean(),
  body("publishing.isFeatured").optional().isBoolean(),
  body("publishing.displayOrder").optional().isInt({ min: 0 }),

  // NEW: Inline stats & placement update
  body("stats.rating").optional().isFloat({ min: 0, max: 5 }),
  body("stats.reviewCount").optional().isInt({ min: 0 }),
  body("stats.studentCount").optional().isInt({ min: 0 }),
  body("stats.projectCount").optional().isInt({ min: 0 }),
  body("placement.hasPlacementSupport").optional().isBoolean(),
  body("placement.hasCertificate").optional().isBoolean(),
  body("placement.hiringPartners").optional().isArray(),
];

// ─── Query filter rules (GET /api/courses) ────────────────────────────────────
const getCourseListRules = [
  // Existing
  query("category").optional().isIn([...CATEGORIES, "all"]).withMessage("Invalid category"),
  query("level").optional().isIn([...LEVELS, "all"]).withMessage("Invalid level"),
  query("featured").optional().isBoolean(),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be >= 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be 1–100"),
  query("sort").optional().isIn(SORT_OPTIONS).withMessage(`Invalid sort. Options: ${SORT_OPTIONS.join(", ")}`),
  query("search").optional().trim().isLength({ max: 100 }),

  // NEW filters
  query("mode")
    .optional()
    .isIn([...MODES, "Any"]).withMessage(`Mode must be one of: ${MODES.join(", ")}, Any`),
  query("schedule")
    .optional()
    .isIn([...SCHEDULES, "Any"]).withMessage(`Schedule must be one of: ${SCHEDULES.join(", ")}, Any`),
  query("durationRange")
    .optional()
    .isIn([...DURATION_RANGES, "Any"]).withMessage(`durationRange must be one of: ${DURATION_RANGES.join(", ")}, Any`),
  query("hasCertificate").optional().isBoolean(),
  query("hasPlacementSupport").optional().isBoolean(),
];

// ─── Stats patch rules ────────────────────────────────────────────────────────
const updateStatsRules = [
  body("rating").optional().isFloat({ min: 0, max: 5 }).withMessage("Rating must be 0–5"),
  body("reviewCount").optional().isInt({ min: 0 }),
  body("studentCount").optional().isInt({ min: 0 }),
  body("projectCount").optional().isInt({ min: 0 }),
];

// ─── Placement patch rules ────────────────────────────────────────────────────
const updatePlacementRules = [
  body("hasPlacementSupport").optional().isBoolean(),
  body("hasCertificate").optional().isBoolean(),
  body("hiringPartners").optional().isArray(),
];

// ─── Middleware: collect and return errors ─────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success : false,
      message : "Validation failed",
      errors  : errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = {
  createCourseRules,
  updateCourseRules,
  getCourseListRules,
  updateStatsRules,
  updatePlacementRules,
  validate,
};
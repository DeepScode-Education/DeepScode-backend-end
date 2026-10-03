const mongoose = require("mongoose");

// ─── Allowed values ────────────────────────────────────────────────────────────
const CATEGORIES  = ["Design", "3D", "Marketing", "Data", "Tech"];
const LEVELS      = ["Beginner", "Intermediate", "Advanced"];
const CURRENCIES  = ["INR", "USD", "EUR"];
const MODES       = ["Online", "Offline", "Hybrid"];           // NEW
const SCHEDULES   = ["Weekday", "Weekend", "Flexible"];        // NEW

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const roadmapModuleSchema = new mongoose.Schema(
  {
    title      : { type: String, required: true, trim: true },
    duration   : { type: String, trim: true },
    description: { type: String, trim: true },
    modules    : [{ type: String, trim: true }],
    schedule   : { type: String, trim: true },
    ctaLabel   : { type: String, trim: true, default: "Download Curriculum" },
    ctaFileUrl : { type: String, trim: true, default: null },
  },
  { _id: false }
);

const portfolioProjectSchema = new mongoose.Schema(
  {
    title      : { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    image      : { type: String, trim: true },
  },
  { _id: false }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer  : { type: String, required: true, trim: true },
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    provider   : { type: String, trim: true },
    title      : { type: String, trim: true },
    description: { type: String, trim: true },
    image      : { type: String, trim: true },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    price        : { type: Number, default: 0, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    currency     : { type: String, enum: CURRENCIES, default: "INR" },
  },
  { _id: false }
);

const downloadsSchema = new mongoose.Schema(
  {
    syllabusPdf: { type: String, trim: true },
    brochurePdf: { type: String, trim: true },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    title      : { type: String, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 320 },
    keywords   : [{ type: String, trim: true }],
    canonical  : { type: String, trim: true },
    ogImage    : { type: String, trim: true },
  },
  { _id: false }
);

const publishingSchema = new mongoose.Schema(
  {
    isPublished : { type: Boolean, default: false },
    isFeatured  : { type: Boolean, default: false },
    displayOrder: { type: Number,  default: 0 },
  },
  { _id: false }
);

// ─── NEW: Course statistics (denormalised counters) ───────────────────────────
// Updated by admin or via a background job — never computed on the fly.
const statsSchema = new mongoose.Schema(
  {
    rating      : { type: Number, default: 0,  min: 0, max: 5 },
    reviewCount : { type: Number, default: 0,  min: 0 },
    studentCount: { type: Number, default: 0,  min: 0 },
    projectCount: { type: Number, default: 0,  min: 0 },
  },
  { _id: false }
);

// ─── NEW: Placement support flags ─────────────────────────────────────────────
const placementSchema = new mongoose.Schema(
  {
    hasPlacementSupport: { type: Boolean, default: false },
    hasCertificate     : { type: Boolean, default: false },
    hiringPartners     : [{ type: String, trim: true }],
  },
  { _id: false }
);

// ─── Main Course Schema ────────────────────────────────────────────────────────

const courseSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    title: {
      type     : String,
      required : [true, "Title is required"],
      trim     : true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    slug: {
      type     : String,
      required : [true, "Slug is required"],
      unique   : true,
      lowercase: true,
      trim     : true,
      match    : [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"],
    },
    shortDescription: {
      type     : String,
      trim     : true,
      maxlength: [300, "Short description cannot exceed 300 characters"],
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    heroTitle      : { type: String, trim: true },
    heroDescription: { type: String, trim: true },
    bannerImage    : { type: String, trim: true },
    thumbnail      : { type: String, trim: true },
    promoVideo     : { type: String, trim: true },

    // ── Overview ──────────────────────────────────────────────────────────────
    overview: { type: String, trim: true },

    // ── Classification ────────────────────────────────────────────────────────
    category: {
      type    : String,
      required: [true, "Category is required"],
      enum    : { values: CATEGORIES, message: `Category must be one of: ${CATEGORIES.join(", ")}` },
    },
    level: {
      type    : String,
      required: [true, "Level is required"],
      enum    : { values: LEVELS, message: `Level must be one of: ${LEVELS.join(", ")}` },
    },
    duration: { type: String, trim: true },
    tag     : { type: String, trim: true },

    // ── NEW: Delivery ─────────────────────────────────────────────────────────
    // Supports the Mode and Schedule sidebar filters on the frontend.
    mode    : { type: String, enum: [...MODES, null], default: null, trim: true },
    schedule: { type: String, enum: [...SCHEDULES, null], default: null, trim: true },

    // ── NEW: Duration in weeks (numeric) — enables "0-4 wks / 5-8 wks / 9+" filter ──
    // Store alongside the free-text `duration` field. Admin sets this.
    durationWeeks: { type: Number, default: null, min: 0 },

    // ── Arrays ────────────────────────────────────────────────────────────────
    highlights         : [{ type: String, trim: true }],
    whatsIncluded      : [{ type: String, trim: true }],
    toolsCovered       : [{ type: String, trim: true }],
    learningOutcomes   : [{ type: String, trim: true }],
    careerOpportunities: [{ type: String, trim: true }],

    // ── Structured sections ───────────────────────────────────────────────────
    roadmap          : [roadmapModuleSchema],
    portfolioProjects: [portfolioProjectSchema],
    faqs             : [faqSchema],
    certification    : certificationSchema,
    pricing          : pricingSchema,
    downloads        : downloadsSchema,
    seo              : seoSchema,
    publishing       : publishingSchema,

    // ── NEW: Statistics & placement ───────────────────────────────────────────
    stats    : { type: statsSchema,     default: () => ({}) },
    placement: { type: placementSchema, default: () => ({}) },

    // ── Backward compat ───────────────────────────────────────────────────────
    isPublished: { type: Boolean, default: false },

    // ── Soft delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date,    default: null,  select: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON    : { virtuals: true },
    toObject  : { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
courseSchema.index({ "publishing.isPublished" : 1 });
courseSchema.index({ "publishing.isFeatured"  : 1 });
courseSchema.index({ "publishing.displayOrder": 1 });
courseSchema.index({ category    : 1 });
courseSchema.index({ level       : 1 });
courseSchema.index({ mode        : 1 });    // NEW
courseSchema.index({ schedule    : 1 });    // NEW
courseSchema.index({ durationWeeks: 1 });   // NEW
courseSchema.index({ isDeleted   : 1 });
courseSchema.index({ "placement.hasPlacementSupport": 1 }); // NEW
courseSchema.index({ title: "text", shortDescription: "text", overview: "text" });

// ─── Pre-find middleware — auto-exclude soft-deleted docs ──────────────────────
const softDeleteFilter = function () {
  const opts = this._mongooseOptions || {};
  if (!opts.includeSoftDeleted) this.where({ isDeleted: { $ne: true } });
};

courseSchema.pre("find",            softDeleteFilter);
courseSchema.pre("findOne",         softDeleteFilter);
courseSchema.pre("findOneAndUpdate",softDeleteFilter);

// ─── Virtual ──────────────────────────────────────────────────────────────────
courseSchema.virtual("effectiveIsPublished").get(function () {
  return this.publishing?.isPublished ?? this.isPublished ?? false;
});

module.exports = mongoose.model("Course", courseSchema);
module.exports.MODES     = MODES;
module.exports.SCHEDULES = SCHEDULES;
module.exports.CATEGORIES = CATEGORIES;
const mongoose = require("mongoose");

// ─── Allowed values ────────────────────────────────────────────────────────────
const WORK_MODES  = ["On-site", "Hybrid", "Remote"];
const PAY_PERIODS = ["Annual", "Monthly"];
const VISIBILITIES = ["Internal", "Public"];
const STATUSES     = ["draft", "published"];

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const incentivesSchema = new mongoose.Schema(
  {
    performanceBonus:      { type: Boolean, default: false },
    performanceBonusValue: { type: Number,  default: null, min: 0 },
    signOnBonus:           { type: Boolean, default: false },
    signOnBonusValue:      { type: Number,  default: null, min: 0 },
  },
  { _id: false }
);

const eligibilitySchema = new mongoose.Schema(
  {
    experienceLevel:  { type: String,  trim: true, default: "" },
    minYears:         { type: Number,  default: null, min: 0 },
    education:        { type: String,  trim: true, default: "" },
    notes:            { type: String,  trim: true, default: "" },
    workAuthRequired: { type: Boolean, default: false },
    backgroundCheck:  { type: Boolean, default: false },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    applicationDeadline: { type: Date,    default: null },
    applicationLimit:    { type: Number,  default: null, min: 0 },
    visibility:          { type: String,  enum: VISIBILITIES, default: "Internal" },
    autoScreening:       { type: Boolean, default: true },
    alertRecipients:     [{ type: String, trim: true }],
  },
  { _id: false }
);

// ─── Main Opportunity Schema ────────────────────────────────────────────────────

const opportunitySchema = new mongoose.Schema(
  {
    // ── Step 1: Basic Info ───────────────────────────────────────────────────
   companyEntity:     { type: String,  trim: true, default: "" },
    internalJobCode:   { type: String,  trim: true, default: "" },
    hiringPartner: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "HiringPartner",
  default: null,
},
hiringManager:     { type: String,  trim: true, default: "" },
    department:        { type: String,  trim: true, default: "" },
    primaryLocation:   { type: String,  trim: true, default: "" },
    urgentRequirement: { type: Boolean, default: false },

    // ── Step 2: Role Details ─────────────────────────────────────────────────
    jobTitle: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
      maxlength: [150, "Job title cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    category:       { type: String, trim: true, default: "" },
    employmentType: { type: String, trim: true, default: "" },
    workMode: {
      type: String,
      enum: { values: WORK_MODES, message: `Work mode must be one of: ${WORK_MODES.join(", ")}` },
      default: "Hybrid",
    },
    openings:         { type: Number, default: 1, min: [1, "Openings must be at least 1"] },
    description:      { type: String, trim: true, default: "" },
    responsibilities: { type: String, trim: true, default: "" },
    requiredSkills:   [{ type: String, trim: true }],
    niceToHaveSkills: [{ type: String, trim: true }],

    // ── Step 3: Compensation ─────────────────────────────────────────────────
    compensationType: { type: String, trim: true, default: "Salary" },
    currency:         { type: String, trim: true, default: "USD ($)" },
    payMin:           { type: Number, default: null, min: 0 },
    payMax:           { type: Number, default: null, min: 0 },
    payPeriod: {
      type: String,
      enum: { values: PAY_PERIODS, message: `Pay period must be one of: ${PAY_PERIODS.join(", ")}` },
      default: "Annual",
    },
    benefits:   [{ type: String, trim: true }],
    incentives: { type: incentivesSchema, default: () => ({}) },

    // ── Step 4: Eligibility ──────────────────────────────────────────────────
    eligibility: { type: eligibilitySchema, default: () => ({}) },

    // ── Step 5: Settings ─────────────────────────────────────────────────────
    settings: { type: settingsSchema, default: () => ({}) },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(", ")}` },
      default: "draft",
    },

    // ── Soft delete ───────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date,    default: null,  select: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
opportunitySchema.index({ jobTitle: "text", department: "text", primaryLocation: "text" });
opportunitySchema.index({ slug: 1 });
opportunitySchema.index({ status: 1 });
opportunitySchema.index({ isDeleted: 1 });
opportunitySchema.index({ "settings.visibility": 1 });
// opportunitySchema.index({ hiringManager: 1 });
opportunitySchema.index({ createdAt: -1 });
opportunitySchema.index({ hiringPartner: 1 });

// ─── Pre-find middleware — auto-exclude soft-deleted docs (same pattern as Course.js) ──
const softDeleteFilter = function () {
  const opts = this._mongooseOptions || {};
  if (!opts.includeSoftDeleted) this.where({ isDeleted: { $ne: true } });
};

opportunitySchema.pre("find",             softDeleteFilter);
opportunitySchema.pre("findOne",          softDeleteFilter);
opportunitySchema.pre("findOneAndUpdate", softDeleteFilter);

module.exports = mongoose.model("Opportunity", opportunitySchema);
module.exports.WORK_MODES   = WORK_MODES;
module.exports.PAY_PERIODS  = PAY_PERIODS;
module.exports.VISIBILITIES = VISIBILITIES;
module.exports.STATUSES     = STATUSES;

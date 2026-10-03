const mongoose = require("mongoose");

// ─── Allowed values ────────────────────────────────────────────────────────────
const TIERS = ["Premier", "Standard"];

const hiringPartnerSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [150, "Company name cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    tier: {
      type: String,
      enum: { values: TIERS, message: `Tier must be one of: ${TIERS.join(", ")}` },
      default: "Standard",
    },

    // ── Denormalised counter, same pattern as Course.stats.studentCount —
    // there's no dedicated "hire" tracking model in this codebase, so this
    // is set/updated by admin (or a future background job), never computed
    // on the fly.
    stats: {
      totalHires: { type: Number, default: 0, min: 0 },
    },

    isActive: { type: Boolean, default: true },

    // ── Soft delete — identical pattern to Course.js / Opportunity.js ──────────
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, default: null, select: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
hiringPartnerSchema.index({ companyName: "text", industry: "text" });
hiringPartnerSchema.index({ slug: 1 });
hiringPartnerSchema.index({ tier: 1 });
hiringPartnerSchema.index({ isActive: 1 });
hiringPartnerSchema.index({ isDeleted: 1 });

// ─── Pre-find middleware — auto-exclude soft-deleted docs (same as Course.js) ──
const softDeleteFilter = function () {
  const opts = this._mongooseOptions || {};
  if (!opts.includeSoftDeleted) this.where({ isDeleted: { $ne: true } });
};

hiringPartnerSchema.pre("find", softDeleteFilter);
hiringPartnerSchema.pre("findOne", softDeleteFilter);
hiringPartnerSchema.pre("findOneAndUpdate", softDeleteFilter);

module.exports = mongoose.model("HiringPartner", hiringPartnerSchema);
module.exports.TIERS = TIERS;
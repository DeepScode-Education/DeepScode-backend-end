const mongoose = require("mongoose");

const AD_LEAD_STATUSES = ["new", "contacted", "interested", "follow-up", "converted", "lost"];
const AD_LEAD_FORM_TYPES = ["enroll_now", "secure_spot"];
const AD_LEAD_SOURCES = ["google_ads", "meta_ads", "website", "organic", "other"];

const adLeadSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 160,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    profile: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },

    mode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    experience: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },

    course: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      index: true,
    },

    source: {
      type: String,
      enum: AD_LEAD_SOURCES,
      default: "google_ads",
      index: true,
    },

    formType: {
      type: String,
      enum: AD_LEAD_FORM_TYPES,
      default: "enroll_now",
      index: true,
    },

    landingPage: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    campaign: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    adGroup: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    keyword: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    utmSource: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    utmMedium: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    utmCampaign: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    utmTerm: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    utmContent: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },

    status: {
      type: String,
      enum: AD_LEAD_STATUSES,
      default: "new",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    convertedAt: {
      type: Date,
      default: null,
    },

    ipAddress: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },

    userAgent: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

adLeadSchema.index({ course: 1, status: 1, createdAt: -1 });
adLeadSchema.index({ source: 1, createdAt: -1 });
adLeadSchema.index({ formType: 1, createdAt: -1 });
adLeadSchema.index({ email: 1, course: 1 });
adLeadSchema.index({ phone: 1, course: 1 });

module.exports = mongoose.model("AdLead", adLeadSchema);
module.exports.AD_LEAD_STATUSES = AD_LEAD_STATUSES;
module.exports.AD_LEAD_FORM_TYPES = AD_LEAD_FORM_TYPES;
module.exports.AD_LEAD_SOURCES = AD_LEAD_SOURCES;

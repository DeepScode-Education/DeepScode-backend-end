// const mongoose = require("mongoose");

// const STATUSES = ["applied", "under_review", "shortlisted", "rejected", "selected"];

// const opportunityApplicationSchema = new mongoose.Schema(
//   {
//     opportunity: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Opportunity",
//       required: true,
//       index: true,
//     },
//     applicant: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       index: true,
//     },

//     fullName: { type: String, required: true, trim: true },
//     email: { type: String, required: true, trim: true, lowercase: true },
//     phone: { type: String, trim: true, default: "" },
//     coverLetter: { type: String, trim: true, default: "" },

//     resume: {
//       url: { type: String, default: "" },
//       publicId: { type: String, default: "" },
//       originalName: { type: String, default: "" },
//     },

//     status: {
//       type: String,
//       enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(", ")}` },
//       default: "applied",
//     },

//     adminRemarks: { type: String, trim: true, default: "" },
//   },
//   { timestamps: true }
// );

// // A student can only apply once to the same opportunity
// opportunityApplicationSchema.index({ opportunity: 1, applicant: 1 }, { unique: true });
// opportunityApplicationSchema.index({ status: 1 });

// const OpportunityApplication = mongoose.model("OpportunityApplication", opportunityApplicationSchema);
// module.exports = OpportunityApplication;
// module.exports.STATUSES = STATUSES;




const mongoose = require("mongoose");
const { LINK_TYPES } = require("../utils/portfolioLinks"); // shared generic link types

const STATUSES = ["applied", "under_review", "shortlisted", "rejected", "selected"];

const applicationLinkSchema = new mongoose.Schema(
  {
    type: { type: String, enum: LINK_TYPES, required: true },
    label: { type: String, trim: true, default: "" }, // required only when type === "Other"
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const opportunityApplicationSchema = new mongoose.Schema(
  {
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: "" },
    coverLetter: { type: String, trim: true, default: "" },

    resume: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      originalName: { type: String, default: "" },
    },

    // ── NEW: generic, role-independent links (LinkedIn, GitHub, Portfolio,
    // Behance, Live Project, etc.) — candidate can add any combination.
    links: {
      type: [applicationLinkSchema],
      default: [],
    },

    status: {
      type: String,
      enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(", ")}` },
      default: "applied",
    },

    adminRemarks: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

opportunityApplicationSchema.index({ opportunity: 1, applicant: 1 }, { unique: true });
opportunityApplicationSchema.index({ status: 1 });

const OpportunityApplication = mongoose.model("OpportunityApplication", opportunityApplicationSchema);
module.exports = OpportunityApplication;
module.exports.STATUSES = STATUSES;
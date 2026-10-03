const mongoose = require("mongoose");

const LEAD_STATUSES = ["new", "contacted", "interested", "follow-up", "converted", "lost"];
const SOURCES = [
  "Website", "WhatsApp", "Instagram", "Facebook",
  "Referral", "Other", "Manual",
  "Walk-in", "Phone", "Google Ads", "Offline Event","Support Ticket",
];

// ── Lead Health (independent business field, separate from leadStatus) ───────
// This tracks the *quality/temperature* of a lead and does NOT drive or gate
// the workflow (new → contacted → interested → follow-up → converted/lost).
// It's a parallel, freely-editable classification a counsellor/admin sets.
const LEAD_HEALTH_OPTIONS = [
  "Untouched",
  "Hot",
  "Warm",
  "Cold",
  "Dead",
  "Fake",
  "Not picked",
  "Not reachable",
  "Collaboration",
];

const conversionRequestSchema = {
  status: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none",
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  requestedAt: {
    type: Date,
    default: null,
  },
  requestNote: {
    type: String,
    default: "",
  },
  finalFee: {
    type: Number,
    default: null,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  rejectedAt: {
    type: Date,
    default: null,
  },
  rejectionReason: {
    type: String,
    default: "",
  },
};

const inquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
    },
    // email: {
    //   type: String,
    //   required: function () {
    //     return this.source !== "Manual" && this.source !== "Walk-in" && this.source !== "Phone";
    //   },
    //   lowercase: true,
    //   trim: true,
    // },

email: {
  type: String,
  required: false, 
  lowercase: true,
  trim: true,
},

    // course: {
    //   type: String,
    //   required: [true, "Course is required"],
    //   enum: ["UiUX", "GraphicDesign", "MotionVFX", "3D", "Marketing", "Data"],
    // },
course: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Course",
  required: [true, "Course is required"],
},
    // ── Old status field (backward compat) ────────────────────────────────────
    status: {
      type: String,
      enum: ["new", "contacted", "enrolled", "dropped"],
      default: "new",
    },

    // ── CRM lead status (workflow — unaffected by leadHealth) ─────────────────
    leadStatus: {
      type: String,
      enum: LEAD_STATUSES,
      default: "new",
    },

    // ── Lead Health (independent business field) ──────────────────────────────
    // Does NOT gate or drive leadStatus workflow transitions.
    leadHealth: {
      type: String,
      enum: { values: LEAD_HEALTH_OPTIONS, message: "Invalid lead health value" },
      default: "Untouched",
    },

    // ── Priority ──────────────────────────────────────────────────────────────
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // ── Assignment ────────────────────────────────────────────────────────────
    // assignedTo: legacy string field kept for backward compat
    assignedTo: {
      type: String,
      default: null,
    },
    // assignedToId: proper ObjectId reference (use this for all new code)
    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── NEW: Creation tracking ─────────────────────────────────────────────────
    // Who actually created this lead record (admin, super_admin, or counsellor).
    // Distinct from assignedToId — a lead can be created by one person and later
    // reassigned to another counsellor. createdBy lets the original counsellor
    // (who manually logged a walk-in/phone lead, for example) keep visibility
    // into leads they created even if assignment changes later.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByRole: {
      type: String,
      enum: ["super_admin", "admin", "counsellor", "mentor", "accountant", null],
      default: null,
    },

    // ── Lead metadata ─────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: { values: SOURCES, message: "Invalid source" },
      default: "Website",
    },
    remarks: {
      type: String,
      default: "",
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
    nextFollowUpDate: {
      type: Date,
      default: null,
    },

    // ── Branch ────────────────────────────────────────────────────────────────
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    // ── Fees ──────────────────────────────────────────────────────────────────
    fees: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      originalFee: { type: Number, default: null },
      negotiatedAmount: { type: Number, default: null },
    },

    paymentPlan: {
      mode: {
        type: String,
        enum: ["full", "emi", null],
        default: null,
      },
      emiMonths: {
        type: Number,
        default: null,
      },
      downPayment: {
        type: Number,
        default: null,
      },
      notes: {
        type: String,
        default: "",
      },
    },

    feeHistory: [
      {
        previousAmount: { type: Number, default: null },
        newAmount: { type: Number, required: true },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          default: "",
        },
        reason: {
          type: String,
          default: "",
        },
        remarks: {
          type: String,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ── Parent / guardian ─────────────────────────────────────────────────────
    parentInfo: {
      fatherName: { type: String, default: "" },
      motherName: { type: String, default: "" },
      guardianName: { type: String, default: "" },
      guardianMobile: { type: String, default: "" },
      // legacy
      name: { type: String, default: "" },
      relation: { type: String, default: "" },
    },

    // ── Demo management ───────────────────────────────────────────────────────
    demoCompleted: { type: Boolean, default: false },
    demoCompletedAt: { type: Date, default: null },
    demoScheduledAt: { type: Date, default: null },
    demoMode: {
      type: String,
      enum: ["online", "offline", "phone", null],
      default: null,
    },
    demoFeedback: { type: String, trim: true, default: "" },
    demoRating: { type: Number, min: 1, max: 5, default: null },

    // ── Objection tracker ─────────────────────────────────────────────────────
    objections: { type: [String], default: [] },

    // ── Lost lead ─────────────────────────────────────────────────────────────
    lostReason: { type: String, trim: true, default: "" },
    lostAt: { type: Date, default: null },
    lostBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    competitor: { type: String, trim: true, default: "" },

    // ── Conversion ────────────────────────────────────────────────────────────
    convertedStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    convertedAt: { type: Date, default: null },
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    conversionRequest: conversionRequestSchema,

    // ── Documents ─────────────────────────────────────────────────────────────
    documents: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, default: "pdf" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Fee collection assignment (independent of lead assignedTo) ─────────────
feeCollectionCounsellor: {
  type: String,
  default: null,
},
feeCollectionCounsellorId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
inquirySchema.index({ mobileNumber: 1 });
inquirySchema.index({ email: 1 });
inquirySchema.index({ leadStatus: 1, createdAt: -1 });
inquirySchema.index({ priority: 1, leadStatus: 1 });
inquirySchema.index({ assignedToId: 1, leadStatus: 1 });
inquirySchema.index({ createdBy: 1 });
inquirySchema.index({ nextFollowUpDate: 1 });
inquirySchema.index({ source: 1 });
inquirySchema.index({ branch: 1 });
inquirySchema.index({ leadHealth: 1 });
inquirySchema.index({ course: 1 });

const Inquiry = mongoose.model("Inquiry", inquirySchema);

module.exports = Inquiry;
module.exports.LEAD_HEALTH_OPTIONS = LEAD_HEALTH_OPTIONS;
module.exports.LEAD_STATUSES = LEAD_STATUSES;
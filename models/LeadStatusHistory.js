// models/LeadStatusHistory.js
//
// Granular audit trail for every leadStatus transition on an Inquiry.
// Separate from LeadTimeline so status-specific queries (e.g.
// "how many times did this lead go from follow-up back to new?")
// can be run efficiently without scanning the full timeline.

const mongoose = require("mongoose");

const LEAD_STATUSES = ["new", "contacted", "interested", "follow-up", "converted", "lost"];

const leadStatusHistorySchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inquiry",
      required: true,
      index: true,
    },

    fromStatus: {
      type: String,
      enum: LEAD_STATUSES,
      required: true,
    },

    toStatus: {
      type: String,
      enum: LEAD_STATUSES,
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changedByName: {
      type: String,
      trim: true,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

leadStatusHistorySchema.index({ leadId: 1, createdAt: -1 });

module.exports = mongoose.model("LeadStatusHistory", leadStatusHistorySchema);
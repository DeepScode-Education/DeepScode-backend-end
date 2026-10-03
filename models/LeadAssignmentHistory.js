// models/LeadAssignmentHistory.js
//
// Every counsellor reassignment for a lead.
// Useful for: "who had this lead before?", "how many handoffs happened?",
// "which counsellor worked this lead the longest?".

const mongoose = require("mongoose");

const leadAssignmentHistorySchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inquiry",
      required: true,
      index: true,
    },

    // Previous owner — null on first assignment
    fromCounsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    fromCounsellorName: {
      type: String,
      trim: true,
      default: null,
    },

    // New owner — null means "unassigned"
    toCounsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    toCounsellorName: {
      type: String,
      trim: true,
      default: null,
    },

    // Admin / super_admin who made the reassignment
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedByName: {
      type: String,
      trim: true,
      default: null,
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

leadAssignmentHistorySchema.index({ leadId: 1, createdAt: -1 });

module.exports = mongoose.model("LeadAssignmentHistory", leadAssignmentHistorySchema);
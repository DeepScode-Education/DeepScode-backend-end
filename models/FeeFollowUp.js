// models/FeeFollowUp.js
//
// Fee-specific follow-up log. Separate from LeadFollowUp because:
//   - it tracks payment-intent (expectedAmount, expectedPaymentDate)
//   - it has fee-specific call statuses
//   - it is linked to a Fee doc, not an Inquiry/lead

const mongoose = require("mongoose");

const CALL_STATUSES = [
  "Connected",
  "Busy",
  "Switched Off",
  "Parent Talked",
  "Student Talked",
  "No Response",
];

const FOLLOW_UP_STATUSES = ["pending", "completed", "cancelled"];

const feeFollowUpSchema = new mongoose.Schema(
  {
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fee",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    callStatus: {
      type: String,
      enum: CALL_STATUSES,
      required: true,
    },

    // When to follow up again
    nextFollowUpDate: { type: Date, default: null },

    // When the student/parent said they'd pay
    expectedPaymentDate: { type: Date, default: null },

    // How much they said they'd pay
    expectedAmount: { type: Number, default: null, min: 0 },

    remarks: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: FOLLOW_UP_STATUSES,
      default: "pending",
    },

    completedAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

feeFollowUpSchema.index({ student: 1, createdAt: -1 });
feeFollowUpSchema.index({ nextFollowUpDate: 1, status: 1 });

module.exports = mongoose.model("FeeFollowUp", feeFollowUpSchema);
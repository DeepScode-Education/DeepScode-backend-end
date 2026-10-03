const mongoose = require("mongoose");

const staffLeaveSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    leaveType: {
      type: String,
      enum: ["casual", "sick", "earned", "unpaid", "other"],
      required: true,
    },

    fromDate: {
      type: Date,
      required: true,
    },

    toDate: {
      type: Date,
      required: true,
    },

    days: {
      type: Number,
      required: true,
      min: 0.5,
    },

    reason: {
      type: String,
      trim: true,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

staffLeaveSchema.index({ staff: 1, fromDate: 1, toDate: 1 });

module.exports = mongoose.model("StaffLeave", staffLeaveSchema);

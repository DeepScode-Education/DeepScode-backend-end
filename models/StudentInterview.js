const mongoose = require("mongoose");

const studentInterviewSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, trim: true, required: true },
    role: { type: String, trim: true, default: "" },
    scheduledAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["scheduled", "completed", "selected", "rejected", "cancelled"],
      default: "scheduled",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

studentInterviewSchema.index({ student: 1, scheduledAt: 1 });

module.exports = mongoose.model("StudentInterview", studentInterviewSchema);
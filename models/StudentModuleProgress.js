const mongoose = require("mongoose");

const STATUSES = ["completed", "in-progress", "locked"];

const studentModuleProgressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "CourseModule", required: true },
    status: { type: String, enum: STATUSES, default: "locked" },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    lastAccess: { type: Date, default: null },
    feedback: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

studentModuleProgressSchema.index({ student: 1, module: 1 }, { unique: true });
studentModuleProgressSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model("StudentModuleProgress", studentModuleProgressSchema);
module.exports.STATUSES = STATUSES;
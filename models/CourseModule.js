const mongoose = require("mongoose");

const courseModuleSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    order: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // If a student has no progress doc yet, this decides the starting state
    defaultLocked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

courseModuleSchema.index({ course: 1, order: 1 }, { unique: true });

module.exports = mongoose.model("CourseModule", courseModuleSchema);
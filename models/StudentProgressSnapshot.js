const mongoose = require("mongoose");

const studentProgressSnapshotSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    weekLabel: { type: String, required: true }, // e.g. "W1"
    progress: { type: Number, min: 0, max: 100, required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

studentProgressSnapshotSchema.index({ student: 1, course: 1, recordedAt: 1 });

module.exports = mongoose.model("StudentProgressSnapshot", studentProgressSnapshotSchema);
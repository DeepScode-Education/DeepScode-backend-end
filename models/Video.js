// models/Video.js
//
// Metadata-only record for mentor-uploaded batch videos. The actual video
// file lives in Google Drive (driveFileId) — never stored in MongoDB.
//
// Batch identification mirrors the existing virtual-batch system used by
// mentorPortal.controller.js (StudentAssignment.batch.days/time grouped by
// course), so no new Batch collection is introduced.

const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    description: { type: String, trim: true, default: "" },

    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },

    // Same shape as StudentAssignment.batch — kept denormalised here so a
    // video's batch can be identified without re-joining StudentAssignment.
    batch: {
      days: { type: String, required: true },
      time: { type: String, required: true },
    },

    // Opaque batch identifier — same encoding scheme already used by the
    // mentor batch endpoints (course::days::time, base64url). Indexed for
    // fast "all videos for this batch" lookups.
    batchKey: { type: String, required: true, index: true },

    driveFileId: { type: String, required: true, unique: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: null }, // seconds, optional

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

videoSchema.index({ batchKey: 1, createdAt: -1 });

module.exports = mongoose.model("Video", videoSchema);
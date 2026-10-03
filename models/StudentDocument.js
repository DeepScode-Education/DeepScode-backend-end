// models/StudentDocument.js
//
// One document per (student, type) slot — the 6 fixed types below.
// Uploading again on the same slot REPLACES the existing document
// (old Cloudinary asset deleted, new one uploaded) — see controller.

const mongoose = require("mongoose");

const DOCUMENT_TYPES = [
  "aadhaar",
  "pan",
  "resume",
  "offer_letter",
  "passport_photo",
  "course_certificate",
];

const DOCUMENT_STATUSES = ["under_review", "verified", "action_required"];

const studentDocumentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: { values: DOCUMENT_TYPES, message: `Type must be one of: ${DOCUMENT_TYPES.join(", ")}` },
      required: true,
    },

    fileUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    fileType: {
      type: String,
      enum: ["pdf", "image", "doc"],
      required: true,
    },
    fileSize: { type: Number, required: true }, // bytes
    originalName: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: { values: DOCUMENT_STATUSES, message: `Status must be one of: ${DOCUMENT_STATUSES.join(", ")}` },
      default: "under_review",
    },

    // Admin note — filled when status = "action_required" (reason for rejection)
    note: { type: String, trim: true, default: "" },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // student themself, or admin if admin uploaded on their behalf
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One active document per (student, type) — replacing overwrites this same doc.
studentDocumentSchema.index({ student: 1, type: 1 }, { unique: true });

const StudentDocument = mongoose.model("StudentDocument", studentDocumentSchema);
module.exports = StudentDocument;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
module.exports.DOCUMENT_STATUSES = DOCUMENT_STATUSES;
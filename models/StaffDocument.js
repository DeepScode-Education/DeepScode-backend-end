const mongoose = require("mongoose");

const staffDocumentSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    documentType: {
      type: String,
      enum: [
        "aadhaar",
        "pan",
        "resume",
        "offer_letter",
        "joining_letter",
        "experience_letter",
        "salary_slip",
        "bank_proof",
        "other",
      ],
      required: true,
    },

    title: {
      type: String,
      trim: true,
      required: true,
    },

    fileUrl: {
      type: String,
      trim: true,
      required: true,
    },

    publicId: {
      type: String,
      trim: true,
      default: "",
    },

    fileName: {
      type: String,
      trim: true,
      default: "",
    },

    mimeType: {
      type: String,
      trim: true,
      default: "",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

staffDocumentSchema.index({ staff: 1, documentType: 1 });

module.exports = mongoose.model("StaffDocument", staffDocumentSchema);

const mongoose = require("mongoose");

const CERT_STATUSES = ["issued", "revoked"];

const certificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, required: true, unique: true, trim: true, uppercase: true },

    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Snapshots — so the certificate stays accurate even if the User/Course
    // documents change later (name correction, course renamed, etc.)
    studentName: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    mentorName: { type: String, trim: true, default: "" },

    issueDate: { type: Date, default: Date.now },

    verificationCode: { type: String, required: true, unique: true, trim: true },
    verificationUrl: { type: String, required: true },

    pdfUrl: { type: String, default: "" },
    pdfPublicId: { type: String, default: "" },

    status: { type: String, enum: CERT_STATUSES, default: "issued" },
    verified: { type: Boolean, default: true },

    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },

    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// Prevent duplicate certificates for the same student + course
certificateSchema.index({ student: 1, course: 1 }, { unique: true });
certificateSchema.index({ certificateId: 1 }, { unique: true });
certificateSchema.index({ status: 1 });

const Certificate = mongoose.model("Certificate", certificateSchema);
module.exports = Certificate;
module.exports.CERT_STATUSES = CERT_STATUSES;
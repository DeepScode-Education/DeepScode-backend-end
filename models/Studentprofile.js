

const mongoose = require("mongoose");

const GOVT_ID_TYPES = ["Aadhaar", "PAN", "Driving License", "Passport"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

const studentProfileSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // ── Personal Details ──
    fullName: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    fatherName: { type: String, trim: true, default: "" },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"],
    },
    gender: {
      type: String,
      enum: { values: GENDER_OPTIONS, message: `Gender must be one of: ${GENDER_OPTIONS.join(", ")}` },
      default: null,
    },

    // ── Address ──
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{6}$/, "Enter a valid 6-digit pincode"],
    },

    // ── Education (NEW) ──
    qualification: { type: String, trim: true, default: "" },
    college: { type: String, trim: true, default: "" },
    degree: { type: String, trim: true, default: "" },
    passingYear: { type: String, trim: true, default: "" },

    // ── Identity Verification (optional now — kept for backward compat) ──
    govtIdType: {
      type: String,
      enum: { values: GOVT_ID_TYPES, message: `Government ID Type must be one of: ${GOVT_ID_TYPES.join(", ")}` },
      default: null,
    },
    govtIdNumber: { type: String, trim: true, default: "" },
    govtIdImageUrl: { type: String, default: "" },
    govtIdImagePublicId: { type: String, default: "" },

    // ── Course Preference — DEPRECATED ──
    // Course/mentor is now assigned by admin only (StudentAssignment collection).
    // Kept for backward compat with old records; no longer required or collected.
    preferredCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

const StudentProfile =
  mongoose.models.StudentProfile ||
  mongoose.model("StudentProfile", studentProfileSchema);

module.exports = StudentProfile;
module.exports.GENDER_OPTIONS = GENDER_OPTIONS;
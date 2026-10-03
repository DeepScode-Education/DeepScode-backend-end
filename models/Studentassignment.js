const mongoose = require("mongoose");

const BATCH_DAYS = ["MTW", "MWT", "MTT", "SS"];
const BATCH_TIMES = ["10:00-12:00", "12:00-2:00", "2:30-4:30", "4:30-6:30"];

const batchSchema = new mongoose.Schema(
  {
    days: {
      type: String,
      enum: { values: BATCH_DAYS, message: `Batch days must be one of: ${BATCH_DAYS.join(", ")}` },
    },
    time: {
      type: String,
      enum: { values: BATCH_TIMES, message: `Batch time must be one of: ${BATCH_TIMES.join(", ")}` },
    },
    batchCode: { type: String, trim: true, default: null }, // e.g. "B27"
    meetingLink: { type: String, trim: true, default: null },
  },
  { _id: false }
);
const studentAssignmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // mentors live in the User collection (role: "mentor")
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "completed", "dropped"],
      default: "active",
    },
    // NEW — batch scheduling, set alongside course + mentor at assignment time
    batch: {
      type: batchSchema,
      default: undefined,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
     hoursInvested: { type: Number, default: 0, min: 0 },
    hoursPerWeekAvg: { type: Number, default: 0, min: 0 },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const StudentAssignment =
  mongoose.models.StudentAssignment ||
  mongoose.model("StudentAssignment", studentAssignmentSchema);

module.exports = StudentAssignment;
module.exports.BATCH_DAYS = BATCH_DAYS;
module.exports.BATCH_TIMES = BATCH_TIMES;
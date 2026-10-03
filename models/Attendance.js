// const mongoose = require("mongoose");

// const attendanceSchema = new mongoose.Schema(
//   {
//     student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
//     course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
//     date: { type: Date, required: true },
//     status: { type: String, enum: ["present", "absent", "leave"], required: true },
//     markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
//   },
//   { timestamps: true }
// );

// attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

// module.exports = mongoose.model("Attendance", attendanceSchema);

// models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "leave"], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // NEW: optional link to the live class session this was marked against
    // (null when marked manually outside/after a session, or for offline-only days)
    liveClass: { type: mongoose.Schema.Types.ObjectId, ref: "LiveClass", default: null },
    // NEW: distinguishes online (joined via Zoom) vs offline (physically present) marking
    mode: { type: String, enum: ["online", "offline"], default: "offline" },
  },
  { timestamps: true }
);

attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
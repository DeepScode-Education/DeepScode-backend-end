// // modules/live-class/models/Attendance.js

// const mongoose = require("mongoose");

// const attendanceSchema = new mongoose.Schema(
//   {
//     liveClass: { type: mongoose.Schema.Types.ObjectId, ref: "LiveClass", required: true, index: true },
//     student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
//     course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },

//     joinTime: { type: Date, default: null },
//     leaveTime: { type: Date, default: null },
//     lastHeartbeat: { type: Date, default: null },

//     durationSeconds: { type: Number, default: 0 },
//     isLate: { type: Boolean, default: false },
//     attendancePercentage: { type: Number, default: 0, min: 0, max: 100 },

//     reconnectCount: { type: Number, default: 0 },
//   },
//   { timestamps: true }
// );

// attendanceSchema.index({ liveClass: 1, student: 1 }, { unique: true });

// module.exports =
//   mongoose.models.Attendance ||
//   mongoose.model("Attendance", AttendanceSchema);




// modules/live-class/models/Attendance.js
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    liveClass: { type: mongoose.Schema.Types.ObjectId, ref: "LiveClass", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },

    joinTime: { type: Date, default: null },
    leaveTime: { type: Date, default: null },
    lastHeartbeat: { type: Date, default: null },

    durationSeconds: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    attendancePercentage: { type: Number, default: 0, min: 0, max: 100 },

    reconnectCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

attendanceSchema.index({ liveClass: 1, student: 1 }, { unique: true });

// Renamed to LiveClassAttendance — avoids the OverwriteModelError collision
// with the pre-existing top-level `Attendance` model used by the course
// attendance/dashboard system (models/Attendance.js).
module.exports =
  mongoose.models.LiveClassAttendance ||
  mongoose.model("LiveClassAttendance", attendanceSchema);
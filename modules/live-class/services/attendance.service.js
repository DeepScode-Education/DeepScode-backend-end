// // modules/live-class/services/attendance.service.js
// const { Attendance, LiveClass } = require("../models");
// const { isStudentInBatch } = require("./liveClass.service");
// const { NotFoundError, AuthorizationError } = require("../../../utils/errors/errorTypes");

// const recordHeartbeat = async ({ studentId, liveClassId }) => {
//   const liveClass = await LiveClass.findById(liveClassId);
//   if (!liveClass) throw new NotFoundError("Live class not found.");

//   // FIX: verify the student actually belongs to this batch before recording
//   const inBatch = await isStudentInBatch(
//     studentId,
//     liveClass.course,
//     liveClass.batch.days,
//     liveClass.batch.time
//   );
//   if (!inBatch) throw new AuthorizationError("You are not enrolled in this batch.");


//   const now = new Date();

//   let attendance = await Attendance.findOne({ liveClass: liveClassId, student: studentId });

//   if (!attendance) {
//     const minutesLate = liveClass.startedAt
//       ? Math.floor((now - liveClass.startedAt) / 60000)
//       : 0;

//     attendance = await Attendance.create({
//       liveClass: liveClassId,
//       student: studentId,
//       course: liveClass.course,
//       joinTime: now,
//       lastHeartbeat: now,
//       isLate: minutesLate > LATE_THRESHOLD_MINUTES,
//     });
//   } else {
//     // Reconnect detection: if last heartbeat was long ago, count as reconnect
//     const gapMinutes = attendance.lastHeartbeat
//       ? (now - attendance.lastHeartbeat) / 60000
//       : 0;
//     if (gapMinutes > 2) {
//       attendance.reconnectCount += 1;
//     }
//     attendance.lastHeartbeat = now;
//     await attendance.save();
//   }

//   return attendance;
// };

// const finalizeAttendanceForClass = async (liveClassId) => {
//   const liveClass = await LiveClass.findById(liveClassId);
//   if (!liveClass || !liveClass.startedAt || !liveClass.endedAt) return;

//   const totalDurationSec = Math.max((liveClass.endedAt - liveClass.startedAt) / 1000, 1);

//   const records = await Attendance.find({ liveClass: liveClassId });

//   await Promise.all(
//     records.map(async (record) => {
//       record.leaveTime = record.leaveTime || record.lastHeartbeat || liveClass.endedAt;
//       const durationSec = Math.max((record.leaveTime - record.joinTime) / 1000, 0);
//       record.durationSeconds = durationSec;
//       record.attendancePercentage = Math.min(
//         Math.round((durationSec / totalDurationSec) * 100),
//         100
//       );
//       await record.save();
//     })
//   );
// };

// module.exports = { recordHeartbeat, finalizeAttendanceForClass };






// modules/live-class/services/attendance.service.js
const { Attendance, LiveClass } = require("../models");
const { isStudentInBatch } = require("./liveClass.service");
const { NotFoundError, AuthorizationError } = require("../../../utils/errors/errorTypes");

// FIX: this constant was used below but never defined — root cause of the crash
const LATE_THRESHOLD_MINUTES = 5;

const recordHeartbeat = async ({ studentId, liveClassId }) => {
  const liveClass = await LiveClass.findById(liveClassId);
  if (!liveClass) throw new NotFoundError("Live class not found.");

  const inBatch = await isStudentInBatch(
    studentId,
    liveClass.course,
    liveClass.batch.days,
    liveClass.batch.time
  );
  if (!inBatch) throw new AuthorizationError("You are not enrolled in this batch.");

  const now = new Date();
  let attendance = await Attendance.findOne({ liveClass: liveClassId, student: studentId });

  if (!attendance) {
    const minutesLate = liveClass.startedAt
      ? Math.floor((now - liveClass.startedAt) / 60000)
      : 0;

    attendance = await Attendance.create({
      liveClass: liveClassId,
      student: studentId,
      course: liveClass.course,
      joinTime: now,
      lastHeartbeat: now,
      isLate: minutesLate > LATE_THRESHOLD_MINUTES,
    });
  } else {
    const gapMinutes = attendance.lastHeartbeat
      ? (now - attendance.lastHeartbeat) / 60000
      : 0;
    if (gapMinutes > 2) attendance.reconnectCount += 1;
    attendance.lastHeartbeat = now;
    await attendance.save();
  }

  return attendance;
};

const finalizeAttendanceForClass = async (liveClassId) => {
  const liveClass = await LiveClass.findById(liveClassId);
  if (!liveClass || !liveClass.startedAt || !liveClass.endedAt) return;

  const totalDurationSec = Math.max((liveClass.endedAt - liveClass.startedAt) / 1000, 1);
  const records = await Attendance.find({ liveClass: liveClassId });

  await Promise.all(
    records.map(async (record) => {
      record.leaveTime = record.leaveTime || record.lastHeartbeat || liveClass.endedAt;
      const durationSec = Math.max((record.leaveTime - record.joinTime) / 1000, 0);
      record.durationSeconds = durationSec;
      record.attendancePercentage = Math.min(Math.round((durationSec / totalDurationSec) * 100), 100);
      await record.save();
    })
  );
};

module.exports = { recordHeartbeat, finalizeAttendanceForClass };
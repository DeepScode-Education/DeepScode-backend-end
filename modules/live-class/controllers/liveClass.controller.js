// // modules/live-class/controllers/liveClass.controller.js

// const catchAsync = require("../../../utils/catchAsync");
// const { liveClassService, attendanceService } = require("../services/index");
// const { closeRoom } = require("../services/livekit.service");
// const { emitMeetingEnded } = require("../sockets/liveClass.socket");

// const startClass = catchAsync(async (req, res) => {
//   const { courseId, days, time, title } = req.body;
//   const liveClass = await liveClassService.startClass({
//     mentorId: req.user.id,
//     courseId,
//     days,
//     time,
//     title,
//   });
//   res.status(201).json({ success: true, message: "Live class started", data: liveClass });
// });

// const endClass = catchAsync(async (req, res) => {
//   // 1. DB: status -> "ended" (atomic; only one caller can win)
//   const liveClass = await liveClassService.endClass({
//     mentorId: req.user.id,
//     liveClassId: req.body.liveClassId,
//   });

//   // 2. LiveKit: delete the room so EVERY participant is force-disconnected,
//   //    even a student whose Socket.IO connection missed the event.
//   await closeRoom(liveClass.livekitRoomName);

//   // 3. Socket.IO: instant "meeting-ended" for everyone in the class room.
//   const io = req.app.get("io");
//   emitMeetingEnded(io, liveClass._id);

//   try {
//     await attendanceService.finalizeAttendanceForClass(liveClass._id);
//   } catch (err) {
//     console.error("[live-end] Attendance finalization failed after class ended:", err.message);
//   }

//   res.status(200).json({ success: true, message: "Live class ended", data: liveClass });
// });

// const joinClass = catchAsync(async (req, res) => {
//   const role = req.user.role === "mentor" ? "mentor" : "student";

//   const userName =
//     req.user.fullName ||
//     req.user.name ||
//     req.user.username ||
//     `${role}-${req.user.id}`;

//   const result = await liveClassService.joinClass({
//     userId: req.user.id,
//     role,
//     liveClassId: req.body.liveClassId,
//     userName,
//   });

//   res.status(200).json({
//     success: true,
//     message: "LiveKit join token generated",
//     data: result,
//   });
// });

// const getCurrent = catchAsync(async (req, res) => {
//   const role = req.user.role === "mentor" ? "mentor" : "student";
//   const data = await liveClassService.getCurrentForUser({ userId: req.user.id, role });
//   res.status(200).json({ success: true, data });
// });

// const getHistory = catchAsync(async (req, res) => {
//   const role = req.user.role === "mentor" ? "mentor" : "student";
//   const data = await liveClassService.getHistoryForUser({ userId: req.user.id, role });
//   res.status(200).json({ success: true, data });
// });

// const getUpcoming = catchAsync(async (req, res) => {
//   const role = req.user.role === "mentor" ? "mentor" : "student";
//   const data = await liveClassService.getUpcomingForUser({ userId: req.user.id, role });
//   res.status(200).json({ success: true, data });
// });

// const attendanceHeartbeat = catchAsync(async (req, res) => {
//   const attendance = await attendanceService.recordHeartbeat({
//     studentId: req.user.id,
//     liveClassId: req.body.liveClassId,
//   });
//   res.status(200).json({ success: true, data: attendance });
// });

// const mentorHeartbeat = catchAsync(async (req, res) => {
//   await require("../models").LiveClass.updateOne(
//     { _id: req.body.liveClassId, mentor: req.user.id, status: "live" },
//     { lastHostHeartbeat: new Date() }
//   );
//   res.status(200).json({ success: true });
// });

// module.exports = {
//   startClass,
//   endClass,
//   joinClass,
//   getCurrent,
//   getHistory,
//   getUpcoming,
//   attendanceHeartbeat,
//   mentorHeartbeat,
// };







const catchAsync = require("../../../utils/catchAsync");
const User = require("../../../models/User");
const { liveClassService, attendanceService } = require("../services/index");
const { closeRoom } = require("../services/livekit.service");
const { emitMeetingEnded } = require("../sockets/liveClass.socket");

const startClass = catchAsync(async (req, res) => {
  const { courseId, days, time, title } = req.body;
  const liveClass = await liveClassService.startClass({
    mentorId: req.user.id,
    courseId,
    days,
    time,
    title,
  });
  res.status(201).json({ success: true, message: "Live class started", data: liveClass });
});

const endClass = catchAsync(async (req, res) => {
  // 1. DB: status -> "ended" (atomic; only one caller can win)
  const liveClass = await liveClassService.endClass({
    mentorId: req.user.id,
    liveClassId: req.body.liveClassId,
  });

  // 2. LiveKit: delete the room so EVERY participant is force-disconnected,
  //    even a student whose Socket.IO connection missed the event.
  await closeRoom(liveClass.livekitRoomName);

  // 3. Socket.IO: instant "meeting-ended" for everyone in the class room.
  const io = req.app.get("io");
  emitMeetingEnded(io, liveClass._id);

  try {
    await attendanceService.finalizeAttendanceForClass(liveClass._id);
  } catch (err) {
    console.error("[live-end] Attendance finalization failed after class ended:", err.message);
  }

  res.status(200).json({ success: true, message: "Live class ended", data: liveClass });
});

const joinClass = catchAsync(async (req, res) => {
  const role = req.user.role === "mentor" ? "mentor" : "student";

  // Resolve the canonical display name from MongoDB so LiveKit participants
  // never fall back to mentor_xxx / student_xxx when JWT does not contain
  // fullName.
  const dbUser = await User.findById(req.user.id)
    .select("fullName name username")
    .lean();

  const userName =
    dbUser?.fullName?.trim() ||
    dbUser?.name?.trim() ||
    dbUser?.username?.trim() ||
    req.user.fullName?.trim() ||
    req.user.name?.trim() ||
    req.user.username?.trim() ||
    `${role}-${req.user.id}`;

  const result = await liveClassService.joinClass({
    userId: req.user.id,
    role,
    liveClassId: req.body.liveClassId,
    userName,
  });

  res.status(200).json({
    success: true,
    message: "LiveKit join token generated",
    data: result,
  });
});

const getCurrent = catchAsync(async (req, res) => {
  const role = req.user.role === "mentor" ? "mentor" : "student";
  const data = await liveClassService.getCurrentForUser({ userId: req.user.id, role });
  res.status(200).json({ success: true, data });
});

const getHistory = catchAsync(async (req, res) => {
  const role = req.user.role === "mentor" ? "mentor" : "student";
  const data = await liveClassService.getHistoryForUser({ userId: req.user.id, role });
  res.status(200).json({ success: true, data });
});

const getUpcoming = catchAsync(async (req, res) => {
  const role = req.user.role === "mentor" ? "mentor" : "student";
  const data = await liveClassService.getUpcomingForUser({ userId: req.user.id, role });
  res.status(200).json({ success: true, data });
});

const attendanceHeartbeat = catchAsync(async (req, res) => {
  const attendance = await attendanceService.recordHeartbeat({
    studentId: req.user.id,
    liveClassId: req.body.liveClassId,
  });
  res.status(200).json({ success: true, data: attendance });
});

const mentorHeartbeat = catchAsync(async (req, res) => {
  await require("../models").LiveClass.updateOne(
    { _id: req.body.liveClassId, mentor: req.user.id, status: "live" },
    { lastHostHeartbeat: new Date() }
  );
  res.status(200).json({ success: true });
});

module.exports = {
  startClass,
  endClass,
  joinClass,
  getCurrent,
  getHistory,
  getUpcoming,
  attendanceHeartbeat,
  mentorHeartbeat,
};

// // modules/live-class/services/liveClass.service.js
// const StudentAssignment = require("../../../models/Studentassignment");
// const { LiveClass } = require("../models");
// const { getProvider } = require("./providerSelector");
// const { NotFoundError, AuthorizationError, ValidationError } = require("../../../utils/errors/errorTypes");

// const getMentorAssignment = (mentorId, courseId, days, time) =>
//   StudentAssignment.findOne({
//     mentor: mentorId,
//     course: courseId,
//     status: "active",
//     "batch.days": days,
//     "batch.time": time,
//   }).populate("course", "title category");

// const isStudentInBatch = async (studentId, courseId, days, time) => {
//   const assignment = await StudentAssignment.findOne({
//     student: studentId,
//     course: courseId,
//     status: "active",
//     "batch.days": days,
//     "batch.time": time,
//   });
//   return !!assignment;
// };

// const startClass = async ({ mentorId, courseId, days, time, title }) => {
//   const assignment = await getMentorAssignment(mentorId, courseId, days, time);
//   if (!assignment) {
//     throw new AuthorizationError("You are not the assigned mentor for this batch.");
//   }

//   const existingLive = await LiveClass.findOne({
//     course: courseId,
//     "batch.days": days,
//     "batch.time": time,
//     status: "live",
//   });
//   if (existingLive) {
//     throw new ValidationError("A live class is already running for this batch.");
//   }

//   const provider = getProvider();
//   const { providerMeetingId, providerMeetingPassword, hostZoomUserId } = await provider.startMeeting({
//     topic: title || `${assignment.course.title} — Live Class`,
//   });

//   const liveClass = await LiveClass.create({
//     course: courseId,
//     mentor: mentorId,
//     batch: { days, time },
//     title: title || `${assignment.course.title} — Live Class`,
//     provider: "zoom",
//     providerMeetingId,
//     providerMeetingPassword,
//     hostZoomUserId: hostZoomUserId || null,
//     status: "live",
//     startedAt: new Date(),
//     lastHostHeartbeat: new Date(),
//     createdBy: mentorId,
//   });

//   return liveClass;
// };

// // const endClass = async ({ mentorId, liveClassId }) => {
// //   const liveClass = await LiveClass.findById(liveClassId);
// //   if (!liveClass) throw new NotFoundError("Live class not found.");
// //   if (String(liveClass.mentor) !== String(mentorId)) {
// //     throw new AuthorizationError("Only the hosting mentor can end this class.");
// //   }
// //   if (liveClass.status !== "live") {
// //     throw new ValidationError("This class is not currently live.");
// //   }

// //   const provider = getProvider();

// //   // If Zoom's own end-meeting call fails for a reason other than
// //   // "meeting already gone" (handled inside provider.endMeeting), that
// //   // error is now a proper ZoomAPIError and will propagate up to the
// //   // centralized error handler instead of being swallowed here.
// //   await provider.endMeeting({ providerMeetingId: liveClass.providerMeetingId });

// //   liveClass.status = "ended";
// //   liveClass.endedAt = new Date();
// //   await liveClass.save();

// //   return liveClass;
// // };

// // slate-server/modules/live-class/services/liveClass.service.js

// const endClass = async ({ mentorId, liveClassId }) => {
//   const liveClass = await LiveClass.findById(liveClassId);
//   if (!liveClass) throw new NotFoundError("Live class not found.");
//   if (String(liveClass.mentor) !== String(mentorId)) {
//     throw new AuthorizationError("Only the hosting mentor can end this class.");
//   }
//   if (liveClass.status !== "live") {
//     throw new ValidationError("This class is not currently live.");
//   }

//   const provider = getProvider();

//   // ✅ FIX: Zoom fail hone par bhi DB update hone chahiye
//   try {
//     await provider.endMeeting({ providerMeetingId: liveClass.providerMeetingId });
//   } catch (zoomErr) {
//     console.error("[endClass] Zoom endMeeting failed, continuing to mark as ended in DB:", zoomErr.message);
//   }

//   liveClass.status = "ended";
//   liveClass.endedAt = new Date();
//   await liveClass.save();

//   return liveClass;
// };

// const joinClass = async ({ userId, role, liveClassId }) => {
//   const liveClass = await LiveClass.findById(liveClassId).select("+providerMeetingPassword");
//   if (!liveClass) throw new NotFoundError("Live class not found.");
//   if (liveClass.status !== "live") {
//     throw new ValidationError("This class has not started yet or has already ended.");
//   }

//   if (role === "mentor") {
//     if (String(liveClass.mentor) !== String(userId)) {
//       throw new AuthorizationError("You are not the host of this class.");
//     }
//   } else {
//     const inBatch = await isStudentInBatch(
//       userId,
//       liveClass.course,
//       liveClass.batch.days,
//       liveClass.batch.time
//     );
//     if (!inBatch) {
//       throw new AuthorizationError("You are not enrolled in this batch.");
//     }
//   }

//   const provider = getProvider();

//   // Verify against Zoom before issuing a signature. Only a confirmed
//   // "meeting does not exist" (Zoom code 3001 / HTTP 404) should self-heal
//   // the record to "ended" — any other failure (auth, network, rate limit)
//   // is transient and must NOT be treated as proof the class is over.
//   const meetingStatus = await provider.getMeetingStatus({ providerMeetingId: liveClass.providerMeetingId });

//   if (meetingStatus.notFound) {
//     liveClass.status = "ended";
//     liveClass.endedAt = liveClass.endedAt || new Date();
//     await liveClass.save();
//     throw new ValidationError(
//       role === "mentor"
//         ? "This live class session is no longer active on Zoom. Please start a new class."
//         : "This class has ended. Please wait for the mentor to start a new session."
//     );
//   }

//   const signature = await provider.generateJoinSignature({
//     providerMeetingId: liveClass.providerMeetingId,
//     role: role === "mentor" ? 1 : 0,
//   });

//   // The mentor (host) needs a ZAK to be fully authenticated by the Meeting
//   // SDK — without it, host media controls (mic/camera/screen-share) are
//   // unreliable even though join() appears to succeed. This now throws
//   // instead of silently continuing: if it fails, the request fails loudly
//   // with a clear 502 (ZOOM_API_ERROR) so the frontend can show an error
//   // and let the mentor retry, rather than entering a broken host session.
//   let zak;
//   if (role === "mentor") {
//     const hostIdentity = liveClass.hostZoomUserId || "me";
//     zak = await provider.getZAKToken(hostIdentity);
//   }

//   return {
//     signature,
//     providerMeetingId: liveClass.providerMeetingId,
//     password: liveClass.providerMeetingPassword || "",
//     sdkKey: process.env.ZOOM_SDK_KEY,
//     liveClassId: liveClass._id,
//     ...(zak ? { zak } : {}),
//   };
// };

// const getCurrentForUser = async ({ userId, role }) => {
//   if (role === "mentor") {
//     return LiveClass.findOne({ mentor: userId, status: "live" }).populate("course", "title");
//   }
//   const assignments = await StudentAssignment.find({ student: userId, status: "active" });
//   const orClauses = assignments
//     .filter((a) => a.batch?.days && a.batch?.time)
//     .map((a) => ({ course: a.course, "batch.days": a.batch.days, "batch.time": a.batch.time }));
//   if (!orClauses.length) return null;
//   return LiveClass.findOne({ status: "live", $or: orClauses }).populate("course", "title");
// };

// const getHistoryForUser = async ({ userId, role }) => {
//   if (role === "mentor") {
//     return LiveClass.find({ mentor: userId, status: "ended" }).sort({ endedAt: -1 }).populate("course", "title");
//   }
//   const assignments = await StudentAssignment.find({ student: userId, status: "active" });
//   const orClauses = assignments
//     .filter((a) => a.batch?.days && a.batch?.time)
//     .map((a) => ({ course: a.course, "batch.days": a.batch.days, "batch.time": a.batch.time }));
//   if (!orClauses.length) return [];
//   return LiveClass.find({ status: "ended", $or: orClauses }).sort({ endedAt: -1 }).populate("course", "title");
// };

// const getUpcomingForUser = async ({ userId, role }) => {
//   if (role === "mentor") {
//     return LiveClass.find({ mentor: userId, status: "scheduled" }).sort({ scheduledAt: 1 }).populate("course", "title");
//   }
//   const assignments = await StudentAssignment.find({ student: userId, status: "active" });
//   const orClauses = assignments
//     .filter((a) => a.batch?.days && a.batch?.time)
//     .map((a) => ({ course: a.course, "batch.days": a.batch.days, "batch.time": a.batch.time }));
//   if (!orClauses.length) return [];
//   return LiveClass.find({ status: "scheduled", $or: orClauses }).sort({ scheduledAt: 1 }).populate("course", "title");
// };

// module.exports = {
//   startClass,
//   endClass,
//   joinClass,
//   getCurrentForUser,
//   getHistoryForUser,
//   getUpcomingForUser,
//   isStudentInBatch,
// };





// modules/live-class/services/liveClass.service.js

const StudentAssignment = require("../../../models/Studentassignment");
const { LiveClass } = require("../models");
const {
  createParticipantToken,
} = require("./livekit.service");

const {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} = require("../../../utils/errors/errorTypes");

/**
 * Find the mentor's active assignment for a particular course/batch.
 */
const getMentorAssignment = (mentorId, courseId, days, time) =>
  StudentAssignment.findOne({
    mentor: mentorId,
    course: courseId,
    status: "active",
    "batch.days": days,
    "batch.time": time,
  }).populate("course", "title category");

/**
 * Check whether a student belongs to the given course/batch.
 */
const isStudentInBatch = async (studentId, courseId, days, time) => {
  const assignment = await StudentAssignment.findOne({
    student: studentId,
    course: courseId,
    status: "active",
    "batch.days": days,
    "batch.time": time,
  });

  return !!assignment;
};

/**
 * Start a LiveKit classroom.
 */
const startClass = async ({
  mentorId,
  courseId,
  days,
  time,
  title,
}) => {
  // 1. Verify mentor is assigned to this batch.
  const assignment = await getMentorAssignment(
    mentorId,
    courseId,
    days,
    time
  );

  if (!assignment) {
    throw new AuthorizationError(
      "You are not the assigned mentor for this batch."
    );
  }

  // 2. Prevent two live classes for the same batch.
  const existingLive = await LiveClass.findOne({
    course: courseId,
    "batch.days": days,
    "batch.time": time,
    status: "live",
  });

  if (existingLive) {
    throw new ValidationError(
      "A live class is already running for this batch."
    );
  }

  // 3. Create a unique LiveKit room name.
  const livekitRoomName = `liveclass_${courseId}_${Date.now()}`;

  // 4. Create LiveClass DB record.
  //
  // LiveKit rooms are created automatically when the first
  // participant connects, so we don't need to call LiveKit
  // just to create the room here.
  const liveClass = await LiveClass.create({
    course: courseId,
    mentor: mentorId,

    batch: {
      days,
      time,
    },

    title:
      title ||
      `${assignment.course.title} — Live Class`,

    provider: "livekit",

    livekitRoomName,

    status: "live",

    startedAt: new Date(),

    lastHostHeartbeat: new Date(),

    createdBy: mentorId,
  });

  return liveClass;
};

/**
 * End a LiveKit classroom.
 */
const endClass = async ({
  mentorId,
  liveClassId,
}) => {
  const liveClass = await LiveClass.findById(liveClassId);

  if (!liveClass) {
    throw new NotFoundError("Live class not found.");
  }

  if (String(liveClass.mentor) !== String(mentorId)) {
    throw new AuthorizationError(
      "Only the hosting mentor can end this class."
    );
  }

  if (liveClass.status !== "live") {
    throw new ValidationError("This class is not currently live.");
  }

  // Only the request that changes a live record may finalize and emit the end
  // event. This prevents a manual end and the stale-class job from racing.
  const endedAt = new Date();
  const endedClass = await LiveClass.findOneAndUpdate(
    { _id: liveClassId, mentor: mentorId, status: "live" },
    { $set: { status: "ended", endedAt } },
    { new: true, runValidators: true },
  );

  if (!endedClass) {
    throw new ValidationError("This class is not currently live.");
  }

  return endedClass;
};

/**
 * Generate a LiveKit token for mentor/student.
 */
const joinClass = async ({
  userId,
  role,
  liveClassId,
  userName,
}) => {
  const liveClass = await LiveClass.findById(liveClassId);

  if (!liveClass) {
    throw new NotFoundError("Live class not found.");
  }

  if (liveClass.status !== "live") {
    throw new ValidationError(
      "This class has not started yet or has already ended."
    );
  }

  // -------------------------
  // Mentor authorization
  // -------------------------

  if (role === "mentor") {
    if (
      String(liveClass.mentor) !== String(userId)
    ) {
      throw new AuthorizationError(
        "You are not the host of this class."
      );
    }
  }

  // -------------------------
  // Student authorization
  // -------------------------

  else {
    const inBatch = await isStudentInBatch(
      userId,
      liveClass.course,
      liveClass.batch.days,
      liveClass.batch.time
    );

    if (!inBatch) {
      throw new AuthorizationError(
        "You are not enrolled in this batch."
      );
    }
  }

  // -------------------------
  // LiveKit permissions
  // -------------------------

  const canPublish = true;
  const canSubscribe = true;

  // Prefix identity so mentor/student identities
  // are easy to distinguish inside the classroom.
  const identity = `${role}_${userId}`;

  const token = await createParticipantToken({
    identity,
    name: userName || identity,
    roomName: liveClass.livekitRoomName,
    canPublish,
    canSubscribe,
  });

  return {
    token,

    livekitUrl: process.env.LIVEKIT_URL,

    roomName: liveClass.livekitRoomName,

    liveClassId: liveClass._id,

    role,

    title: liveClass.title,

    batch: liveClass.batch,
  };
};

/**
 * Get currently running class for user.
 */
const getCurrentForUser = async ({
  userId,
  role,
}) => {
  if (role === "mentor") {
    return LiveClass.findOne({
      mentor: userId,
      status: "live",
    }).populate("course", "title");
  }

  const assignments = await StudentAssignment.find({
    student: userId,
    status: "active",
  });

  const orClauses = assignments
    .filter(
      (a) =>
        a.batch?.days &&
        a.batch?.time
    )
    .map((a) => ({
      course: a.course,
      "batch.days": a.batch.days,
      "batch.time": a.batch.time,
    }));

  if (!orClauses.length) {
    return null;
  }

  return LiveClass.findOne({
    status: "live",
    $or: orClauses,
  }).populate("course", "title");
};

/**
 * Get class history for user.
 */
const getHistoryForUser = async ({
  userId,
  role,
}) => {
  if (role === "mentor") {
    return LiveClass.find({
      mentor: userId,
      status: "ended",
    })
      .sort({ endedAt: -1 })
      .populate("course", "title");
  }

  const assignments = await StudentAssignment.find({
    student: userId,
    status: "active",
  });

  const orClauses = assignments
    .filter(
      (a) =>
        a.batch?.days &&
        a.batch?.time
    )
    .map((a) => ({
      course: a.course,
      "batch.days": a.batch.days,
      "batch.time": a.batch.time,
    }));

  if (!orClauses.length) {
    return [];
  }

  return LiveClass.find({
    status: "ended",
    $or: orClauses,
  })
    .sort({ endedAt: -1 })
    .populate("course", "title");
};

/**
 * Get upcoming classes for user.
 */
const getUpcomingForUser = async ({
  userId,
  role,
}) => {
  if (role === "mentor") {
    return LiveClass.find({
      mentor: userId,
      status: "scheduled",
    })
      .sort({ scheduledAt: 1 })
      .populate("course", "title");
  }

  const assignments = await StudentAssignment.find({
    student: userId,
    status: "active",
  });

  const orClauses = assignments
    .filter(
      (a) =>
        a.batch?.days &&
        a.batch?.time
    )
    .map((a) => ({
      course: a.course,
      "batch.days": a.batch.days,
      "batch.time": a.batch.time,
    }));

  if (!orClauses.length) {
    return [];
  }

  return LiveClass.find({
    status: "scheduled",
    $or: orClauses,
  })
    .sort({ scheduledAt: 1 })
    .populate("course", "title");
};

module.exports = {
  startClass,
  endClass,
  joinClass,
  getCurrentForUser,
  getHistoryForUser,
  getUpcomingForUser,
  isStudentInBatch,
};
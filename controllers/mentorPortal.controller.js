

// const StudentAssignment = require("../models/Studentassignment");
// const AssignmentSubmission = require("../models/AssignmentSubmission");
// const User = require("../models/User");
// const Course = require("../models/Course");
// const Attendance = require("../models/Attendance");
// const { LiveClass } = require("../modules/live-class/models/Attendance");

// // NEW — was missing, caused getBatchAttendance/markBatchAttendance to crash
// // with "startOfDayUTC is not defined" (500 error), which the frontend
// // silently swallowed and showed as "No students in this batch".
// const startOfDayUTC = (input) => {
//   const d = new Date(input);
//   return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
// };

// const send = (res, status, success, message, data, extra = {}) => {
//   const body = { success, message, ...extra };
//   if (data !== undefined) body.data = data;
//   return res.status(status).json(body);
// };

// const getMentorAssignmentDocs = (mentorId) =>
//   StudentAssignment.find({ mentor: mentorId, status: "active" })
//     .populate("student", "fullName email studentId")
//     .populate("course", "title category");

// // ── Batch key helpers ─────────────────────────────────────────────────────────
// // A "batch" is a virtual grouping — there's no Batch collection. We group
// // StudentAssignment docs by (course._id, batch.days, batch.time) and encode
// // that triple as a single opaque ID so the frontend can round-trip it via
// // GET /api/mentor/batches/:id/students without us inventing a new model.
// const UNSCHEDULED_MARKER = "unscheduled";

// const buildBatchKey = (courseId, days, time) =>
//   `${courseId}::${days || UNSCHEDULED_MARKER}::${time || UNSCHEDULED_MARKER}`;

// const encodeBatchId = (key) => Buffer.from(key, "utf8").toString("base64url");
// const decodeBatchId = (id) => {
//   try {
//     return Buffer.from(id, "base64url").toString("utf8");
//   } catch (_) {
//     return null;
//   }
// };

// // Groups a mentor's active assignments into batch buckets.
// const groupIntoBatches = (assignments) => {
//   const batchMap = new Map();

//   assignments.forEach((a) => {
//     if (!a.course || !a.student) return;

//     const days = a.batch?.days || null;
//     const time = a.batch?.time || null;
//     const key = buildBatchKey(a.course._id, days, time);

//     if (!batchMap.has(key)) {
//       batchMap.set(key, {
//         id: encodeBatchId(key),
//         course: a.course.title,
//         courseId: a.course._id,
//         category: a.course.category,
//         batchDays: days,
//         batchTime: time,
//         isUnscheduled: !days || !time,
//         totalStudents: 0,
//         studentAssignmentIds: [],
//       });
//     }

//     const bucket = batchMap.get(key);
//     bucket.totalStudents += 1;
//     bucket.studentAssignmentIds.push(a._id);
//   });

//   return Array.from(batchMap.values());
// };

// // GET /api/mentor/students
// const getMyStudents = async (req, res) => {
//   try {
//     const assignments = await getMentorAssignmentDocs(req.user.id);

//     const students = assignments
//       .filter((a) => a.student)
//       .map((a) => ({
//         _id: a.student._id,
//         fullName: a.student.fullName,
//         email: a.student.email,
//         studentId: a.student.studentId ?? null,
//         course: a.course?.title ?? null,
//         batchDays: a.batch?.days ?? null,
//         batchTime: a.batch?.time ?? null,
//         progress: 0,
//         lastActivity: a.updatedAt,
//       }));

//     // Fill in real progress from AssignmentSubmission counts
//     const submissions = await AssignmentSubmission.find({
//       student: { $in: students.map((s) => s._id) },
//     }).select("student status updatedAt");

//     const byStudent = {};
//     submissions.forEach((s) => {
//       const key = String(s.student);
//       byStudent[key] = byStudent[key] || { total: 0, approved: 0, lastActivity: null };
//       byStudent[key].total += 1;
//       if (s.status === "Approved") byStudent[key].approved += 1;
//       if (!byStudent[key].lastActivity || s.updatedAt > byStudent[key].lastActivity) {
//         byStudent[key].lastActivity = s.updatedAt;
//       }
//     });

//     const enriched = students.map((s) => {
//       const stat = byStudent[String(s._id)];
//       return {
//         ...s,
//         progress: stat && stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0,
//         lastActivity: stat?.lastActivity ?? s.lastActivity,
//       };
//     });

//     return send(res, 200, true, "Students fetched", enriched);
//   } catch (error) {
//     console.error("getMyStudents error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // GET /api/mentor/courses
// const getMyCourses = async (req, res) => {
//   try {
//     const assignments = await getMentorAssignmentDocs(req.user.id);

//     const courseMap = new Map();
//     assignments.forEach((a) => {
//       if (!a.course) return;
//       const key = String(a.course._id);
//       if (!courseMap.has(key)) {
//         courseMap.set(key, {
//           _id: a.course._id,
//           title: a.course.title,
//           category: a.course.category,
//           studentsCount: 0,
//         });
//       }
//       courseMap.get(key).studentsCount += 1;
//     });

//     return send(res, 200, true, "Courses fetched", Array.from(courseMap.values()));
//   } catch (error) {
//     console.error("getMyCourses error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // GET /api/mentor/classes
// // No dedicated "live class" model exists yet in this codebase — returning
// // an empty list so the frontend renders its proper empty state rather than
// // erroring. Wire this to a real Class/Schedule model once one exists.
// const getMyClasses = async (req, res) => {
//   return send(res, 200, true, "Classes fetched", []);
// };

// // ── NEW: GET /api/mentor/batches ──────────────────────────────────────────────
// // Groups the mentor's active StudentAssignment docs by (course, batch.days,
// // batch.time) and returns one row per unique batch.
// const getMyBatches = async (req, res) => {
//   try {
//     const assignments = await getMentorAssignmentDocs(req.user.id);
//     const batches = groupIntoBatches(assignments);

//     const response = batches
//       .map(({ studentAssignmentIds, ...batch }) => batch)
//       .sort((a, b) => a.course.localeCompare(b.course));

//     return send(res, 200, true, "Batches fetched", response);
//   } catch (error) {
//     console.error("getMyBatches error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── NEW: GET /api/mentor/batches/:id/students ─────────────────────────────────
// // :id is the opaque base64url-encoded batch key produced by getMyBatches.
// // Recomputes the mentor's batches fresh (never trusts a stale/foreign key)
// // and returns only the batch matching this mentor's own assignment set —
// // this is what stops a mentor from guessing another mentor's batch id.
// const getBatchStudents = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const decodedKey = decodeBatchId(id);
//     if (!decodedKey) {
//       return send(res, 400, false, "Invalid batch ID");
//     }

//     const assignments = await getMentorAssignmentDocs(req.user.id);
//     const batches = groupIntoBatches(assignments);
//     const batch = batches.find((b) => b.id === id);

//     if (!batch) {
//       return send(res, 404, false, "Batch not found or not assigned to you");
//     }

//     const batchAssignments = assignments.filter((a) =>
//       batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id))
//     );

//     const studentIds = batchAssignments.filter((a) => a.student).map((a) => a.student._id);

//     const submissions = await AssignmentSubmission.find({
//       student: { $in: studentIds },
//     }).select("student status");

//     const progressMap = {};
//     submissions.forEach((s) => {
//       const key = String(s.student);
//       progressMap[key] = progressMap[key] || { total: 0, approved: 0 };
//       progressMap[key].total += 1;
//       if (s.status === "Approved") progressMap[key].approved += 1;
//     });

//     const students = batchAssignments
//       .filter((a) => a.student)
//       .map((a) => {
//         const stat = progressMap[String(a.student._id)];
//         return {
//           name: a.student.fullName,
//           email: a.student.email,
//           studentId: a.student.studentId ?? null,
//           progress: stat && stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0,
//           assignmentStatus:
//             stat && stat.total > 0
//               ? `${stat.approved}/${stat.total} approved`
//               : "No submissions yet",
//         };
//       });

//     return send(res, 200, true, "Batch students fetched", {
//       batch: {
//         course: batch.course,
//          courseId: batch.courseId, 
//         days: batch.batchDays,
//         time: batch.batchTime,
//       },
//       students,
//     });
//   } catch (error) {
//     console.error("getBatchStudents error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // GET /api/mentor/dashboard
// const getDashboard = async (req, res) => {
//   try {
//     const assignments = await getMentorAssignmentDocs(req.user.id);
//     const studentIds = assignments.filter((a) => a.student).map((a) => a.student._id);

//     const [pendingCount, approvedCount, recentSubmissions] = await Promise.all([
//       AssignmentSubmission.countDocuments({
//         student: { $in: studentIds },
//         status: { $in: ["Submitted", "Under Review"] },
//       }),
//       AssignmentSubmission.countDocuments({
//         student: { $in: studentIds },
//         status: "Approved",
//       }),
//       AssignmentSubmission.find({ student: { $in: studentIds } })
//         .populate("student", "fullName")
//         .sort({ createdAt: -1 })
//         .limit(5),
//     ]);

//     const courseSet = new Set(assignments.filter((a) => a.course).map((a) => String(a.course._id)));
//     const batches = groupIntoBatches(assignments);

//     const stats = {
//       totalStudents: studentIds.length,
//       totalBatches: batches.length,
//       activeCourses: courseSet.size,
//       pendingAssignments: pendingCount,
//       // kept for backward compat with the existing MentorDashboard.tsx UI
//       assignedStudents: studentIds.length,
//       completedReviews: approvedCount,
//     };

//     const recentAssignments = recentSubmissions.map((s) => ({
//       _id: s._id,
//       studentName: s.student?.fullName ?? "Student",
//       title: s.title,
//       course: s.category,
//       status: s.status,
//       submittedDate: s.submittedDate,
//     }));

//     return send(res, 200, true, "Dashboard fetched", {
//       stats,
//       batches: batches
//         .map(({ studentAssignmentIds, courseId, isUnscheduled, ...b }) => b)
//         .sort((a, b) => b.totalStudents - a.totalStudents),
//       recentAssignments,
//       upcomingClasses: [],
//     });
//   } catch (error) {
//     console.error("getDashboard error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// const getBatchAttendance = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { date, liveClassId } = req.query;

//     const decodedKey = decodeBatchId(id);
//     if (!decodedKey) return send(res, 400, false, "Invalid batch ID");

//     const assignments = await getMentorAssignmentDocs(req.user.id);
//     const batches = groupIntoBatches(assignments);
//     const batch = batches.find((b) => b.id === id);
//     if (!batch) return send(res, 404, false, "Batch not found or not assigned to you");

//     const batchAssignments = assignments.filter((a) =>
//       batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id))
//     );

//     const targetDate = startOfDayUTC(date ? new Date(date) : new Date());
//     const studentIds = batchAssignments.filter((a) => a.student).map((a) => a.student._id);

//     const existingRecords = await Attendance.find({
//       student: { $in: studentIds },
//       date: targetDate,
//     }).select("student status mode liveClass");

//     const recordMap = new Map(existingRecords.map((r) => [String(r.student), r]));

//     const students = batchAssignments
//       .filter((a) => a.student)
//       .map((a) => {
//         const rec = recordMap.get(String(a.student._id));
//         return {
//           studentId: a.student._id,
//           fullName: a.student.fullName,
//           email: a.student.email,
//           studentIdCode: a.student.studentId ?? null,
//           status: rec ? rec.status : null, // null = not yet marked
//           mode: rec ? rec.mode : null,
//         };
//       });

//     // Optional: if a liveClassId was passed and it belongs to this mentor/batch,
//     // surface who actually joined online via heartbeat attendance — useful as
//     // a hint while marking, not a requirement.
//     let onlineJoinedIds = new Set();
//     if (liveClassId) {
//       try {
//         const LiveClassAttendance = require("../../modules/live-class/models").Attendance;
//         const joined = await LiveClassAttendance.find({ liveClass: liveClassId }).select("student");
//         onlineJoinedIds = new Set(joined.map((j) => String(j.student)));
//       } catch (_) {
//         // live-class module attendance is best-effort only — never block manual marking
//       }
//     }

//     const enriched = students.map((s) => ({
//       ...s,
//       joinedOnline: onlineJoinedIds.has(String(s.studentId)),
//     }));

//     return send(res, 200, true, "Batch attendance fetched", {
//       batch: { course: batch.course, days: batch.batchDays, time: batch.batchTime },
//       date: targetDate,
//       students: enriched,
//     });
//   } catch (error) {
//     console.error("getBatchAttendance error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // ── POST /api/mentor/batches/:id/attendance ──────────────────────────────────
// // body: { date?: "YYYY-MM-DD", liveClassId?: string, records: [{ studentId, status, mode? }] }
// // Upserts one Attendance doc per (student, date). Works any time — live,
// // ended, or never-started — since it only needs the batch assignment.
// const markBatchAttendance = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { date, liveClassId, records } = req.body;

//     if (!Array.isArray(records) || records.length === 0) {
//       return send(res, 400, false, "records array is required");
//     }

//     const VALID_STATUSES = ["present", "absent", "leave"];
//     for (const r of records) {
//       if (!r.studentId || !VALID_STATUSES.includes(r.status)) {
//         return send(res, 400, false, "Each record needs a valid studentId and status");
//       }
//     }

//     const decodedKey = decodeBatchId(id);
//     if (!decodedKey) return send(res, 400, false, "Invalid batch ID");

//     const assignments = await getMentorAssignmentDocs(req.user.id);
//     const batches = groupIntoBatches(assignments);
//     const batch = batches.find((b) => b.id === id);
//     if (!batch) return send(res, 404, false, "Batch not found or not assigned to you");

//     // Guard: only allow marking attendance for students actually in this batch
//     const validStudentIds = new Set(
//       assignments
//         .filter((a) => batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id)))
//         .filter((a) => a.student)
//         .map((a) => String(a.student._id))
//     );

//     const invalid = records.filter((r) => !validStudentIds.has(String(r.studentId)));
//     if (invalid.length > 0) {
//       return send(res, 400, false, "Some students do not belong to this batch");
//     }

//     const targetDate = startOfDayUTC(date ? new Date(date) : new Date());

//     const ops = records.map((r) => ({
//       updateOne: {
//         filter: { student: r.studentId, date: targetDate },
//         update: {
//           $set: {
//             student: r.studentId,
//             date: targetDate,
//             status: r.status,
//             course: batch.courseId,
//             markedBy: req.user.id,
//             mode: r.mode || "offline",
//             liveClass: liveClassId || null,
//           },
//         },
//         upsert: true,
//       },
//     }));

//     await Attendance.bulkWrite(ops);

//     return send(res, 200, true, `Attendance saved for ${records.length} student(s)`, {
//       date: targetDate,
//       count: records.length,
//     });
//   } catch (error) {
//     console.error("markBatchAttendance error:", error);
//     return send(res, 500, false, "Server error");
//   }
// };

// // module.exports.getBatchAttendance = getBatchAttendance;
// // module.exports.markBatchAttendance = markBatchAttendance;

// module.exports = {
//   getDashboard,
//   getMyStudents,
//   getMyCourses,
//   getMyClasses,
//   getMyBatches,
//   getBatchStudents,
//   getBatchAttendance,
//   markBatchAttendance,
// };


const StudentAssignment = require("../models/Studentassignment");
const AssignmentSubmission = require("../models/AssignmentSubmission");
const User = require("../models/User");
const Course = require("../models/Course");
const Attendance = require("../models/Attendance");
const { LiveClass } = require("../modules/live-class/models/Attendance");

// NEW — was missing, caused getBatchAttendance/markBatchAttendance to crash
// with "startOfDayUTC is not defined" (500 error), which the frontend
// silently swallowed and showed as "No students in this batch".
const startOfDayUTC = (input) => {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const getMentorAssignmentDocs = (mentorId) =>
  StudentAssignment.find({ mentor: mentorId, status: "active" })
    .populate("student", "fullName email studentId")
    .populate("course", "title category");

// ── Batch key helpers ─────────────────────────────────────────────────────────
// A "batch" is a virtual grouping — there's no Batch collection. We group
// StudentAssignment docs by (course._id, batch.days, batch.time) and encode
// that triple as a single opaque ID so the frontend can round-trip it via
// GET /api/mentor/batches/:id/students without us inventing a new model.
const UNSCHEDULED_MARKER = "unscheduled";

const buildBatchKey = (courseId, days, time) =>
  `${courseId}::${days || UNSCHEDULED_MARKER}::${time || UNSCHEDULED_MARKER}`;

const encodeBatchId = (key) => Buffer.from(key, "utf8").toString("base64url");
const decodeBatchId = (id) => {
  try {
    return Buffer.from(id, "base64url").toString("utf8");
  } catch (_) {
    return null;
  }
};

// Groups a mentor's active assignments into batch buckets.
const groupIntoBatches = (assignments) => {
  const batchMap = new Map();

  assignments.forEach((a) => {
    if (!a.course || !a.student) return;

    const days = a.batch?.days || null;
    const time = a.batch?.time || null;
    const key = buildBatchKey(a.course._id, days, time);

    if (!batchMap.has(key)) {
      batchMap.set(key, {
        id: encodeBatchId(key),
        course: a.course.title,
        courseId: a.course._id,
        category: a.course.category,
        batchDays: days,
        batchTime: time,
        isUnscheduled: !days || !time,
        totalStudents: 0,
        studentAssignmentIds: [],
      });
    }

    const bucket = batchMap.get(key);
    bucket.totalStudents += 1;
    bucket.studentAssignmentIds.push(a._id);
  });

  return Array.from(batchMap.values());
};

// GET /api/mentor/students
const getMyStudents = async (req, res) => {
  try {
    const assignments = await getMentorAssignmentDocs(req.user.id);

    const students = assignments
      .filter((a) => a.student)
      .map((a) => ({
        _id: a.student._id,
        fullName: a.student.fullName,
        email: a.student.email,
        studentId: a.student.studentId ?? null,
        course: a.course?.title ?? null,
        batchDays: a.batch?.days ?? null,
        batchTime: a.batch?.time ?? null,
        progress: 0,
        lastActivity: a.updatedAt,
      }));

    // Fill in real progress from AssignmentSubmission counts
    const submissions = await AssignmentSubmission.find({
      student: { $in: students.map((s) => s._id) },
    }).select("student status updatedAt");

    const byStudent = {};
    submissions.forEach((s) => {
      const key = String(s.student);
      byStudent[key] = byStudent[key] || { total: 0, approved: 0, lastActivity: null };
      byStudent[key].total += 1;
      if (s.status === "Approved") byStudent[key].approved += 1;
      if (!byStudent[key].lastActivity || s.updatedAt > byStudent[key].lastActivity) {
        byStudent[key].lastActivity = s.updatedAt;
      }
    });

    const enriched = students.map((s) => {
      const stat = byStudent[String(s._id)];
      return {
        ...s,
        progress: stat && stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0,
        lastActivity: stat?.lastActivity ?? s.lastActivity,
      };
    });

    return send(res, 200, true, "Students fetched", enriched);
  } catch (error) {
    console.error("getMyStudents error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/mentor/courses
const getMyCourses = async (req, res) => {
  try {
    const assignments = await getMentorAssignmentDocs(req.user.id);

    const courseMap = new Map();
    assignments.forEach((a) => {
      if (!a.course) return;
      const key = String(a.course._id);
      if (!courseMap.has(key)) {
        courseMap.set(key, {
          _id: a.course._id,
          title: a.course.title,
          category: a.course.category,
          studentsCount: 0,
        });
      }
      courseMap.get(key).studentsCount += 1;
    });

    return send(res, 200, true, "Courses fetched", Array.from(courseMap.values()));
  } catch (error) {
    console.error("getMyCourses error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/mentor/classes
// No dedicated "live class" model exists yet in this codebase — returning
// an empty list so the frontend renders its proper empty state rather than
// erroring. Wire this to a real Class/Schedule model once one exists.
const getMyClasses = async (req, res) => {
  return send(res, 200, true, "Classes fetched", []);
};

// ── NEW: GET /api/mentor/batches ──────────────────────────────────────────────
// Groups the mentor's active StudentAssignment docs by (course, batch.days,
// batch.time) and returns one row per unique batch.
const getMyBatches = async (req, res) => {
  try {
    const assignments = await getMentorAssignmentDocs(req.user.id);
    const batches = groupIntoBatches(assignments);

    const response = batches
      .map(({ studentAssignmentIds, ...batch }) => batch)
      .sort((a, b) => a.course.localeCompare(b.course));

    return send(res, 200, true, "Batches fetched", response);
  } catch (error) {
    console.error("getMyBatches error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── NEW: GET /api/mentor/batches/:id/students ─────────────────────────────────
// :id is the opaque base64url-encoded batch key produced by getMyBatches.
// Recomputes the mentor's batches fresh (never trusts a stale/foreign key)
// and returns only the batch matching this mentor's own assignment set —
// this is what stops a mentor from guessing another mentor's batch id.
const getBatchStudents = async (req, res) => {
  try {
    const { id } = req.params;

    const decodedKey = decodeBatchId(id);
    if (!decodedKey) {
      return send(res, 400, false, "Invalid batch ID");
    }

    const assignments = await getMentorAssignmentDocs(req.user.id);
    const batches = groupIntoBatches(assignments);
    const batch = batches.find((b) => b.id === id);

    if (!batch) {
      return send(res, 404, false, "Batch not found or not assigned to you");
    }

    const batchAssignments = assignments.filter((a) =>
      batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id))
    );

    const studentIds = batchAssignments.filter((a) => a.student).map((a) => a.student._id);

    const submissions = await AssignmentSubmission.find({
      student: { $in: studentIds },
    }).select("student status");

    const progressMap = {};
    submissions.forEach((s) => {
      const key = String(s.student);
      progressMap[key] = progressMap[key] || { total: 0, approved: 0 };
      progressMap[key].total += 1;
      if (s.status === "Approved") progressMap[key].approved += 1;
    });

    const students = batchAssignments
      .filter((a) => a.student)
      .map((a) => {
        const stat = progressMap[String(a.student._id)];
        return {
          name: a.student.fullName,
          email: a.student.email,
          studentId: a.student.studentId ?? null,
          progress: stat && stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0,
          assignmentStatus:
            stat && stat.total > 0
              ? `${stat.approved}/${stat.total} approved`
              : "No submissions yet",
        };
      });

    return send(res, 200, true, "Batch students fetched", {
      batch: {
        course: batch.course,
         courseId: batch.courseId, 
        days: batch.batchDays,
        time: batch.batchTime,
      },
      students,
    });
  } catch (error) {
    console.error("getBatchStudents error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/mentor/dashboard
const getDashboard = async (req, res) => {
  try {
    const assignments = await getMentorAssignmentDocs(req.user.id);
    const studentIds = assignments.filter((a) => a.student).map((a) => a.student._id);

    const [pendingCount, approvedCount, recentSubmissions] = await Promise.all([
      AssignmentSubmission.countDocuments({
        student: { $in: studentIds },
        status: { $in: ["Submitted", "Under Review"] },
      }),
      AssignmentSubmission.countDocuments({
        student: { $in: studentIds },
        status: "Approved",
      }),
      AssignmentSubmission.find({ student: { $in: studentIds } })
        .populate("student", "fullName")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const courseSet = new Set(assignments.filter((a) => a.course).map((a) => String(a.course._id)));
    const batches = groupIntoBatches(assignments);

    const stats = {
      totalStudents: studentIds.length,
      totalBatches: batches.length,
      activeCourses: courseSet.size,
      pendingAssignments: pendingCount,
      // kept for backward compat with the existing MentorDashboard.tsx UI
      assignedStudents: studentIds.length,
      completedReviews: approvedCount,
    };

    const recentAssignments = recentSubmissions.map((s) => ({
      _id: s._id,
      studentName: s.student?.fullName ?? "Student",
      title: s.title,
      course: s.category,
      status: s.status,
      submittedDate: s.submittedDate,
    }));

    return send(res, 200, true, "Dashboard fetched", {
      stats,
      batches: batches
        .map(({ studentAssignmentIds, courseId, isUnscheduled, ...b }) => b)
        .sort((a, b) => b.totalStudents - a.totalStudents),
      recentAssignments,
      upcomingClasses: [],
    });
  } catch (error) {
    console.error("getDashboard error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getBatchAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, liveClassId } = req.query;

    const decodedKey = decodeBatchId(id);
    if (!decodedKey) return send(res, 400, false, "Invalid batch ID");

    const assignments = await getMentorAssignmentDocs(req.user.id);
    const batches = groupIntoBatches(assignments);
    const batch = batches.find((b) => b.id === id);
    if (!batch) return send(res, 404, false, "Batch not found or not assigned to you");

    const batchAssignments = assignments.filter((a) =>
      batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id))
    );

    const targetDate = startOfDayUTC(date ? new Date(date) : new Date());
    const studentIds = batchAssignments.filter((a) => a.student).map((a) => a.student._id);

    const existingRecords = await Attendance.find({
      student: { $in: studentIds },
      date: targetDate,
    }).select("student status mode liveClass");

    const recordMap = new Map(existingRecords.map((r) => [String(r.student), r]));

    const students = batchAssignments
      .filter((a) => a.student)
      .map((a) => {
        const rec = recordMap.get(String(a.student._id));
        return {
          studentId: a.student._id,
          fullName: a.student.fullName,
          email: a.student.email,
          studentIdCode: a.student.studentId ?? null,
          status: rec ? rec.status : null, // null = not yet marked
          mode: rec ? rec.mode : null,
        };
      });

    // Optional: if a liveClassId was passed and it belongs to this mentor/batch,
    // surface who actually joined online via heartbeat attendance — useful as
    // a hint while marking, not a requirement.
    let onlineJoinedIds = new Set();
    if (liveClassId) {
      try {
        const LiveClassAttendance = require("../modules/live-class/models").Attendance;
        const joined = await LiveClassAttendance.find({ liveClass: liveClassId }).select("student");
        onlineJoinedIds = new Set(joined.map((j) => String(j.student)));
      } catch (_) {
        // live-class module attendance is best-effort only — never block manual marking
      }
    }

    const enriched = students.map((s) => ({
      ...s,
      joinedOnline: onlineJoinedIds.has(String(s.studentId)),
    }));

    return send(res, 200, true, "Batch attendance fetched", {
      batch: { course: batch.course, days: batch.batchDays, time: batch.batchTime },
      date: targetDate,
      students: enriched,
    });
  } catch (error) {
    console.error("getBatchAttendance error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── POST /api/mentor/batches/:id/attendance ──────────────────────────────────
// body: { date?: "YYYY-MM-DD", liveClassId?: string, records: [{ studentId, status, mode? }] }
// Upserts one Attendance doc per (student, date). Works any time — live,
// ended, or never-started — since it only needs the batch assignment.
const markBatchAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, liveClassId, records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return send(res, 400, false, "records array is required");
    }

    const VALID_STATUSES = ["present", "absent", "leave"];
    for (const r of records) {
      if (!r.studentId || !VALID_STATUSES.includes(r.status)) {
        return send(res, 400, false, "Each record needs a valid studentId and status");
      }
    }

    const decodedKey = decodeBatchId(id);
    if (!decodedKey) return send(res, 400, false, "Invalid batch ID");

    const assignments = await getMentorAssignmentDocs(req.user.id);
    const batches = groupIntoBatches(assignments);
    const batch = batches.find((b) => b.id === id);
    if (!batch) return send(res, 404, false, "Batch not found or not assigned to you");

    // Guard: only allow marking attendance for students actually in this batch
    const validStudentIds = new Set(
      assignments
        .filter((a) => batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id)))
        .filter((a) => a.student)
        .map((a) => String(a.student._id))
    );

    const invalid = records.filter((r) => !validStudentIds.has(String(r.studentId)));
    if (invalid.length > 0) {
      return send(res, 400, false, "Some students do not belong to this batch");
    }

    const targetDate = startOfDayUTC(date ? new Date(date) : new Date());

    const ops = records.map((r) => ({
      updateOne: {
        filter: { student: r.studentId, date: targetDate },
        update: {
          $set: {
            student: r.studentId,
            date: targetDate,
            status: r.status,
            course: batch.courseId,
            markedBy: req.user.id,
            mode: r.mode || "offline",
            liveClass: liveClassId || null,
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(ops);

    return send(res, 200, true, `Attendance saved for ${records.length} student(s)`, {
      date: targetDate,
      count: records.length,
    });
  } catch (error) {
    console.error("markBatchAttendance error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  getDashboard,
  getMyStudents,
  getMyCourses,
  getMyClasses,
  getMyBatches,
  getBatchStudents,
  getBatchAttendance,
  markBatchAttendance,
  // Exported so controllers/mentorVideo.controller.js reuses the exact
  // same virtual-batch identification logic instead of re-implementing it.
  encodeBatchId,
  decodeBatchId,
  buildBatchKey,
  groupIntoBatches,
  getMentorAssignmentDocs,
};
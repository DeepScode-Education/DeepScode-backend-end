// const StudentAssignment = require("../models/Studentassignment");
// const User = require("../models/User");
// const Course = require("../models/Course");
// const { normalizeAssignment } = require("../utils/assignmentMapper");

// // Fields to pull from User when populating a mentor (mentor data now lives
// // on the User collection, role: "mentor" — see Mentor.controller.js).
// const MENTOR_POPULATE_FIELDS = "fullName email phone designation company photoUrl expertise isActive";
// const COURSE_POPULATE_FIELDS = "title category price duration level";

// // PATCH /api/admin/students/:id/assign  — admin only
// // body: { course, mentor }  (mentor optional)
// const assignCourseAndMentor = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { course, mentor } = req.body;

//     if (!course) {
//       return res.status(400).json({ success: false, message: "Course is required" });
//     }

//     const student = await User.findById(id);
//     if (!student || student.role !== "student") {
//       return res.status(404).json({ success: false, message: "Student Not Found" });
//     }

//     const courseDoc = await Course.findById(course);
//     if (!courseDoc) {
//       return res.status(400).json({ success: false, message: "Invalid course" });
//     }

//     // ── FIXED: mentors now live in the User collection (role: "mentor"),
//     // NOT the old standalone Mentor collection. Validate against User. ──
//     if (mentor) {
//       const mentorDoc = await User.findOne({ _id: mentor, role: "mentor" });
//       if (!mentorDoc) {
//         return res.status(400).json({ success: false, message: "Invalid mentor" });
//       }
//     }

//     const assignment = await StudentAssignment.findOneAndUpdate(
//       { student: id },
//       {
//         student: id,
//         course,
//         mentor: mentor || null,
//         status: "active",
//         assignedBy: req.user.id,
//         assignedAt: new Date(),
//       },
//       { new: true, upsert: true, runValidators: true }
//     )
//       .populate("course", COURSE_POPULATE_FIELDS)
//       .populate("mentor", MENTOR_POPULATE_FIELDS);

//     return res.status(200).json({
//       success: true,
//       message: "Course & Mentor assigned successfully",
//       data: normalizeAssignment(assignment),
//     });
//   } catch (error) {
//     console.error("assignCourseAndMentor error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // GET /api/student/assignment — student views their own assignment
// const getMyAssignment = async (req, res) => {
//   try {
//     const assignment = await StudentAssignment.findOne({ student: req.user.id })
//       .populate("course", COURSE_POPULATE_FIELDS)
//       .populate("mentor", MENTOR_POPULATE_FIELDS);

//     return res.status(200).json({ success: true, data: normalizeAssignment(assignment) });
//   } catch (error) {
//     console.error("getMyAssignment error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// module.exports = { assignCourseAndMentor, getMyAssignment };






const StudentAssignment = require("../models/Studentassignment");
const { BATCH_DAYS, BATCH_TIMES } = require("../models/Studentassignment");
const User = require("../models/User");
const Course = require("../models/Course");
const { normalizeAssignment } = require("../utils/assignmentMapper");

// Fields to pull from User when populating a mentor (mentor data now lives
// on the User collection, role: "mentor" — see Mentor.controller.js).
const MENTOR_POPULATE_FIELDS = "fullName email phone designation company photoUrl expertise isActive";
const COURSE_POPULATE_FIELDS = "title category price duration level";

// PATCH /api/admin/students/:id/assign  — admin only
// body: { course, mentor, batch: { days, time } }  (mentor optional, batch optional)
//
// Batch validation is intentionally soft-required: if the admin sends a
// `batch` object at all, BOTH days and time must be valid values from the
// fixed enums. If `batch` is omitted entirely, the assignment is saved
// without a batch (e.g. legacy flows, or "assign course/mentor first, set
// batch later" workflows) — this keeps the existing API from breaking for
// any caller that doesn't yet know about batches.
const assignCourseAndMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { course, mentor, batch } = req.body;

    if (!course) {
      return res.status(400).json({ success: false, message: "Course is required" });
    }

    const student = await User.findById(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student Not Found" });
    }

    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(400).json({ success: false, message: "Invalid course" });
    }

    // ── Mentors live in the User collection (role: "mentor") ──
    if (mentor) {
      const mentorDoc = await User.findOne({ _id: mentor, role: "mentor" });
      if (!mentorDoc) {
        return res.status(400).json({ success: false, message: "Invalid mentor" });
      }
    }

    // ── Batch validation ──
    let batchPayload;
    if (batch !== undefined && batch !== null) {
      const { days, time } = batch;

      if (!days || !BATCH_DAYS.includes(days)) {
        return res.status(400).json({
          success: false,
          message: `Batch days is required and must be one of: ${BATCH_DAYS.join(", ")}`,
        });
      }
      if (!time || !BATCH_TIMES.includes(time)) {
        return res.status(400).json({
          success: false,
          message: `Batch time is required and must be one of: ${BATCH_TIMES.join(", ")}`,
        });
      }

      batchPayload = { days, time };
    }

    const updateDoc = {
      student: id,
      course,
      mentor: mentor || null,
      status: "active",
      assignedBy: req.user.id,
      assignedAt: new Date(),
    };

    // Only touch `batch` if the caller actually sent one — omitting it from
    // the update means an existing batch (if any) is preserved rather than
    // wiped out on every re-save of course/mentor.
    if (batchPayload) {
      updateDoc.batch = batchPayload;
    }

    const assignment = await StudentAssignment.findOneAndUpdate(
      { student: id },
      updateDoc,
      { new: true, upsert: true, runValidators: true }
    )
      .populate("course", COURSE_POPULATE_FIELDS)
      .populate("mentor", MENTOR_POPULATE_FIELDS);

    return res.status(200).json({
      success: true,
      message: "Course & Mentor assigned successfully",
      data: normalizeAssignment(assignment),
    });
  } catch (error) {
    console.error("assignCourseAndMentor error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/student/assignment — student views their own assignment
const getMyAssignment = async (req, res) => {
  try {
    const assignment = await StudentAssignment.findOne({ student: req.user.id })
      .populate("course", COURSE_POPULATE_FIELDS)
      .populate("mentor", MENTOR_POPULATE_FIELDS);

    return res.status(200).json({ success: true, data: normalizeAssignment(assignment) });
  } catch (error) {
    console.error("getMyAssignment error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { assignCourseAndMentor, getMyAssignment };
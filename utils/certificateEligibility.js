// utils/certificateEligibility.js
//
// Calculates certificate eligibility purely from data that already exists
// in the system. "Mentor sign-off" has no dedicated field anywhere in the
// codebase, so it's derived as a proxy: all of the student's assignment
// submissions being "Approved" by their mentor.

const StudentAssignment = require("../models/Studentassignment");
const CourseModule = require("../models/CourseModule");
const StudentModuleProgress = require("../models/StudentModuleProgress");
const Attendance = require("../models/Attendance");
const Portfolio = require("../models/Portfolio");
const Fee = require("../models/Fee");
const AssignmentSubmission = require("../models/AssignmentSubmission");

const MIN_ATTENDANCE_REQUIRED = 75;

const computeCertificateEligibility = async (studentId) => {
  const assignment = await StudentAssignment.findOne({ student: studentId, status: "active" })
    .populate("course", "title category")
    .populate("mentor", "fullName designation");

  if (!assignment || !assignment.course) {
    return {
      hasCourseAssigned: false,
      course: null,
      mentor: null,
      requirements: [],
      overallProgress: 0,
      eligible: false,
    };
  }

  const courseId = assignment.course._id;

  // 1. Module completion — reuses the same logic as the student dashboard
  const [courseModules, progressDocs] = await Promise.all([
    CourseModule.find({ course: courseId }).lean(),
    StudentModuleProgress.find({ student: studentId, course: courseId }).lean(),
  ]);

  let modulesProgress = 0;
  if (courseModules.length > 0) {
    const progressMap = new Map(progressDocs.map((p) => [String(p.module), p]));
    const total = courseModules.reduce((sum, mod) => {
      const p = progressMap.get(String(mod._id));
      return sum + (p ? p.progress : 0);
    }, 0);
    modulesProgress = Math.round(total / courseModules.length);
  }

  // 2. Portfolio submission — Portfolio.status per your Portfolio model
  const portfolios = await Portfolio.find({ student: studentId, course: courseId })
    .select("status")
    .lean();
  const portfolioApproved = portfolios.some((p) => ["approved", "published"].includes(p.status));
  const portfolioSubmitted = portfolios.some((p) =>
    ["pending", "approved", "published"].includes(p.status)
  );
  const portfolioProgress = portfolioApproved ? 100 : portfolioSubmitted ? 60 : 0;

  // 3. Attendance — same source as StudentAttendance controller
  const attendanceRecords = await Attendance.find({ student: studentId }).select("status").lean();
  const totalMarked = attendanceRecords.length;
  const present = attendanceRecords.filter((r) => r.status === "present").length;
  const attendancePercent = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;
  const attendanceProgress = Math.min(
    Math.round((attendancePercent / MIN_ATTENDANCE_REQUIRED) * 100),
    100
  );

  // 4. Fee clearance — reuses Fee.remainingAmount / finalFee
  const fee = await Fee.findOne({ student: studentId }).lean();
  let feeProgress = 0;
  if (fee) {
    const finalFee = fee.finalFee || fee.totalFees || 0;
    if ((fee.remainingAmount || 0) <= 0) {
      feeProgress = 100;
    } else if (finalFee > 0) {
      feeProgress = Math.round(((finalFee - fee.remainingAmount) / finalFee) * 100);
    }
  }
  const feesCleared = feeProgress >= 100;

  // 5. Mentor sign-off — proxy: all assignment submissions Approved
  const submissions = await AssignmentSubmission.find({ student: studentId }).select("status").lean();
  let mentorSignOffProgress = 0;
  if (submissions.length > 0) {
    const approved = submissions.filter((s) => s.status === "Approved").length;
    mentorSignOffProgress = Math.round((approved / submissions.length) * 100);
  }

  const requirements = [
    { id: "modules", title: "Complete all modules", progress: modulesProgress },
    { id: "portfolio", title: "Submit final portfolio", progress: portfolioProgress },
    { id: "attendance", title: `Attendance above ${MIN_ATTENDANCE_REQUIRED}%`, progress: attendanceProgress },
    { id: "fees", title: "Clear all installments", progress: feeProgress },
    { id: "mentorSignOff", title: "Mentor sign-off", progress: mentorSignOffProgress },
  ];

  const overallProgress = Math.round(
    requirements.reduce((s, r) => s + r.progress, 0) / requirements.length
  );

  const eligible =
    modulesProgress >= 100 &&
    portfolioApproved &&
    attendancePercent >= MIN_ATTENDANCE_REQUIRED &&
    feesCleared;

  return {
    hasCourseAssigned: true,
    course: { _id: assignment.course._id, title: assignment.course.title, category: assignment.course.category },
    mentor: assignment.mentor
      ? { _id: assignment.mentor._id, fullName: assignment.mentor.fullName, designation: assignment.mentor.designation }
      : null,
    requirements,
    overallProgress,
    eligible,
  };
};

module.exports = { computeCertificateEligibility, MIN_ATTENDANCE_REQUIRED };
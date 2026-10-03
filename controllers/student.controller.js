const Enrollment = require("../models/Enrollment");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Course = require("../models/Course");
const StudentProfile =
require("../models/Studentprofile");

const StudentAssignment =
require("../models/Studentassignment");

const Fee = require("../models/Fee");
const { normalizeAssignment } = require("../utils/assignmentMapper");

const CourseModule = require("../models/CourseModule");
const StudentModuleProgress = require("../models/StudentModuleProgress");
const Attendance = require("../models/Attendance");
const Portfolio = require("../models/Portfolio");
const StudentInterview = require("../models/StudentInterview");
const { resolveLiveClassInfo } = require("../utils/batchSchedule");

const MIN_ATTENDANCE_REQUIRED = 75;

const startOfDayUTC = (d) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};


// const getStudentDashboard = async (
//   req,
//   res
// ) => {
//   try {
//     const enrollments =
//       await Enrollment.find({
//         student: req.user.id,
//       }).populate(
//         "course",
//         "title description price thumbnail"
//       );

//     const payments =
//       await Payment.find({
//         student: req.user.id,
//       });

//     const totalSpent = payments.reduce(
//       (sum, payment) =>
//         sum + payment.amount,
//       0
//     );

//     // ── NEW: ERP flow data (profile / assignment / fee / successful payments) ──
//     const profile = await StudentProfile.findOne({
//       student: req.user.id,
//     }).populate("preferredCourse", "title category");

//     const assignment = await StudentAssignment.findOne({
//       student: req.user.id,
//     })
//       .populate("course", "title category price duration level")
//       .populate("mentor", "name email specialization photoUrl");

//     const fee = await Fee.findOne({ student: req.user.id }).populate(
//       "course",
//       "title price"
//     );

//     const successfulPayments = await Payment.find({
//       student: req.user.id,
//       paymentStatus: "success",
//     }).sort({ paymentNumber: 1 });

//     return res.status(200).json({
//       success: true,

//       // ── existing (legacy self-enroll) fields — unchanged ──
//       myCourses:
//         enrollments.length,

//       totalSpent,

//       courses: enrollments,

//       payments,

//       // ── NEW: ERP fields ──
//       profile,    // null until "Complete Your Profile" form is submitted
//       assignment, // null until admin assigns a course/mentor
//       fee,        // null until admin sets up a fee plan
//       feePayments: successfulPayments, // ERP payment history (Fee/EMI based)
//     });
//   } catch (error) {
//     console.log(error);

//     return res.status(500).json({
//       success: false,
//       message: "Server Error",
//     });
//   }
// };

// const getStudentDashboard = async (req, res) => {
//   try {
//     const enrollments = await Enrollment.find({ student: req.user.id }).populate(
//       "course",
//       "title description price thumbnail"
//     );

//     const payments = await Payment.find({ student: req.user.id });
//     const totalSpent = payments.reduce((sum, payment) => sum + payment.amount, 0);

//     // ── NEW: fetch the User doc for basic identity fields ──
//     const userDoc = await User.findById(req.user.id).select("fullName email studentId profileCompleted");

//     const profile = await StudentProfile.findOne({ student: req.user.id });

//     // const assignment = await StudentAssignment.findOne({ student: req.user.id })
//     //   .populate("course", "title category price duration level")
//     //   .populate("mentor", "name email specialization photoUrl");


//     const assignment = await StudentAssignment.findOne({
//   student: req.user.id,
// })
//   .populate("course", "title category price duration level")
//   // FIXED: mentor lives on User collection now (role: "mentor")
//   .populate("mentor", "fullName email phone designation company photoUrl expertise isActive");

//     const fee = await Fee.findOne({ student: req.user.id }).populate("course", "title price");

//     const successfulPayments = await Payment.find({
//       student: req.user.id,
//       paymentStatus: "success",
//     }).sort({ paymentNumber: 1 });

//     return res.status(200).json({
//       success: true,

//       // ── legacy self-enroll fields (unchanged) ──
//       myCourses: enrollments.length,
//       totalSpent,
//       courses: enrollments,
//       payments,

//       // ── NEW: identity node for Profile page header ──
//       student: userDoc
//         ? {
//             fullName: userDoc.fullName,
//             email: userDoc.email,
//             studentId: userDoc.studentId,
//             profileCompleted: userDoc.profileCompleted,
//           }
//         : null,

//       // ── ERP fields ──
//       profile,
//        assignment: normalizeAssignment(assignment), 
//       fee,
//       feePayments: successfulPayments,
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };



const getStudentDashboard = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.id }).populate(
      "course",
      "title description price thumbnail"
    );

    const payments = await Payment.find({ student: req.user.id });
    const totalSpent = payments.reduce((sum, payment) => sum + payment.amount, 0);

    const userDoc = await User.findById(req.user.id).select("fullName email studentId profileCompleted");

    const profile = await StudentProfile.findOne({ student: req.user.id });

    const assignment = await StudentAssignment.findOne({
      student: req.user.id,
    })
      .populate("course", "title category price duration level")
      .populate("mentor", "fullName email phone designation company photoUrl expertise isActive");

    const fee = await Fee.findOne({ student: req.user.id }).populate("course", "title price");

    const successfulPayments = await Payment.find({
      student: req.user.id,
      paymentStatus: "success",
    }).sort({ paymentNumber: 1 });

    // ── NEW: dashboard widgets (stat cards, roadmap, attendance, streak) ──
    const courseId = assignment && assignment.course ? assignment.course._id : null;

    let modulesSummary = { overallProgress: 0, completedCount: 0, totalCount: 0, roadmap: [] };
    if (courseId) {
      const [courseModules, progressDocs] = await Promise.all([
        CourseModule.find({ course: courseId }).sort({ order: 1 }).lean(),
        StudentModuleProgress.find({ student: req.user.id, course: courseId }).lean(),
      ]);

      const progressMap = new Map();
      progressDocs.forEach((p) => progressMap.set(String(p.module), p));

      const merged = courseModules.map((mod) => {
        const p = progressMap.get(String(mod._id));
        return {
          id: String(mod._id),
          title: mod.title,
          status: p ? p.status : mod.defaultLocked ? "locked" : "in-progress",
          progress: p ? p.progress : 0,
          lastAccess: p ? p.lastAccess : null,
          feedback: p ? p.feedback : null,
        };
      });

      const total = merged.length;
      const completed = merged.filter((m) => m.status === "completed").length;
      const overall = total > 0 ? Math.round(merged.reduce((s, m) => s + m.progress, 0) / total) : 0;

      modulesSummary = {
        overallProgress: overall,
        completedCount: completed,
        totalCount: total,
        roadmap: merged
          .slice()
          .sort((a, b) => (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0))
          .slice(0, 4),
      };
    }

    // Attendance — last 6 months trend
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const attendanceRecords = await Attendance.find({
      student: req.user.id,
      date: { $gte: sixMonthsAgo },
    }).lean();

    const monthBuckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("en-IN", { month: "short" }) });
    }

    const attendanceTrend = monthBuckets.map(({ year, month, label }) => {
      const recs = attendanceRecords.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === year && rd.getMonth() === month;
      });
      const presentCount = recs.filter((r) => r.status === "present").length;
      return { month: label, attendance: recs.length > 0 ? Math.round((presentCount / recs.length) * 100) : 0 };
    });

    const totalAttendanceRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter((r) => r.status === "present").length;
    const attendancePercent = totalAttendanceRecords > 0 ? Math.round((totalPresent / totalAttendanceRecords) * 100) : 0;

    // 14-day activity streak
    const fourteenDaysAgo = startOfDayUTC(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));
    const recentAttendance = await Attendance.find({
      student: req.user.id,
      date: { $gte: fourteenDaysAgo },
      status: "present",
    }).select("date").lean();

    let recentModuleAccess = [];
    if (courseId) {
      recentModuleAccess = await StudentModuleProgress.find({
        student: req.user.id,
        course: courseId,
        lastAccess: { $gte: fourteenDaysAgo },
      }).select("lastAccess").lean();
    }

    const activeDateKeys = new Set();
    recentAttendance.forEach((r) => activeDateKeys.add(startOfDayUTC(r.date).toISOString()));
    recentModuleAccess.forEach((r) => {
      if (r.lastAccess) activeDateKeys.add(startOfDayUTC(r.lastAccess).toISOString());
    });

    const streakDays = [];
    for (let i = 13; i >= 0; i--) {
      const day = startOfDayUTC(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      streakDays.push(activeDateKeys.has(day.toISOString()));
    }
    let currentStreak = 0;
    for (let i = streakDays.length - 1; i >= 0; i--) {
      if (streakDays[i]) currentStreak++;
      else break;
    }

    // Portfolio
    const portfolioDocs = await Portfolio.find({ student: req.user.id }).select("status").lean();
    const portfolioApproved = portfolioDocs.filter((p) => ["approved", "published"].includes(p.status)).length;
    const portfolioInProgress = portfolioDocs.filter((p) => ["draft", "pending"].includes(p.status)).length;
    const portfolioTarget = Math.max(portfolioDocs.length, 10);

    // Placement readiness
    const interviews = await StudentInterview.find({
      student: req.user.id,
      status: { $in: ["scheduled", "completed"] },
      scheduledAt: { $gte: now },
    }).lean();

    const profileCompletionScore = profile ? 100 : 0;
    const placementReadiness = Math.round(
      modulesSummary.overallProgress * 0.4 +
        (portfolioTarget > 0 ? (portfolioApproved / portfolioTarget) * 100 : 0) * 0.3 +
        profileCompletionScore * 0.15 +
        attendancePercent * 0.15
    );

    // Fees
    const feesPending = fee ? Math.max(fee.remainingAmount || 0, 0) : 0;
    const feeDueDate = fee ? fee.nextDueDate : null;

    // Next class
    let nextClass = null;
    if (assignment) {
      const batch = assignment.batch || {};
      const info = resolveLiveClassInfo(
        batch.days || null,
        batch.time || null,
        assignment.mentor ? assignment.mentor.fullName : "TBA",
        batch.meetingLink || null
      );
      nextClass = {
        status: info.status,
        dateLabel:
          info.status === "live"
            ? "Live now"
            : info.nextClassDate
            ? info.nextClassDate.toLocaleDateString("en-IN", { weekday: "short" })
            : "—",
        timeLabel: info.timeLabel,
        moduleTitle:
          modulesSummary.roadmap.find((m) => m.status === "in-progress")?.title ||
          (assignment.course ? assignment.course.title : "—"),
      };
    }

    const statCards = [
      { label: "Course Progress", value: `${modulesSummary.overallProgress}%`, note: `${modulesSummary.completedCount} of ${modulesSummary.totalCount} modules`, key: "course" },
      { label: "Attendance", value: `${attendancePercent}%`, note: `Min required ${MIN_ATTENDANCE_REQUIRED}%`, key: "attendance" },
      { label: "Portfolio Projects", value: `${portfolioApproved}/${portfolioTarget}`, note: `${portfolioInProgress} in progress`, key: "portfolio" },
      { label: "Placement Readiness", value: `${placementReadiness}%`, note: `${interviews.length} interview(s) lined up`, key: "placement" },
      {
        label: "Fees Pending",
        value: `₹${feesPending.toLocaleString("en-IN")}`,
        note: feeDueDate ? `Due ${new Date(feeDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : "No due date",
        key: "fees",
      },
      {
        label: "Next Class",
        value: nextClass ? `${nextClass.dateLabel}${nextClass.timeLabel !== "—" ? " " + nextClass.timeLabel.split(" - ")[0] : ""}`.trim() : "Not scheduled",
        note: nextClass ? nextClass.moduleTitle : "No batch assigned",
        key: "nextClass",
      },
    ];

    const snapshotStats = [
      { label: "Course", value: modulesSummary.overallProgress, color: "#0037FF" },
      { label: "Attendance", value: attendancePercent, color: "#10b981" },
      { label: "Placement", value: placementReadiness, color: "#8b5cf6" },
      { label: "Portfolio", value: portfolioTarget > 0 ? Math.round((portfolioApproved / portfolioTarget) * 100) : 0, color: "#f59e0b" },
    ];

    return res.status(200).json({
      success: true,

      // ── legacy fields (unchanged) ──
      myCourses: enrollments.length,
      totalSpent,
      courses: enrollments,
      payments,

      student: userDoc
        ? {
            fullName: userDoc.fullName,
            email: userDoc.email,
            studentId: userDoc.studentId,
            profileCompleted: userDoc.profileCompleted,
          }
        : null,

      profile,
      assignment: normalizeAssignment(assignment),
      fee,
      feePayments: successfulPayments,

      // ── NEW: dashboard widgets ──
      statCards,
      snapshotStats,
      streak: { days: streakDays, currentStreak },
      roadmap: modulesSummary.roadmap,
      attendanceTrend,
      attendancePercent,
      nextClass,
      hasCourseAssigned: !!courseId,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


const getDashboardStats = async (req, res) => {
  try {
    console.log("Dashboard Stats API Hit");

    const totalStudents = await User.countDocuments({
      role: "student",
    });

    const totalCourses = await Course.countDocuments();

    console.log({
      totalStudents,
      totalCourses,
    });

    res.status(200).json({
      success: true,
      totalStudents,
      totalCourses,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// PUT /api/admin/students/:studentId/assign-counsellor
const assignCounsellor = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { counsellorId } = req.body;

    if (!isValidId(studentId)) 
      return res.status(400).json({ success: false, message: "Invalid student ID" });

    if (counsellorId && !isValidId(counsellorId))
      return res.status(400).json({ success: false, message: "Invalid counsellor ID" });

    // Verify counsellor exists
    if (counsellorId) {
      const counsellor = await User.findOne({ _id: counsellorId, role: "counsellor" });
      if (!counsellor)
        return res.status(404).json({ success: false, message: "Counsellor not found" });
    }

    const student = await User.findOneAndUpdate(
      { _id: studentId, role: "student" },
      { assignedCounsellor: counsellorId || null },
      { new: true }
    ).populate("assignedCounsellor", "fullName email");

    if (!student)
      return res.status(404).json({ success: false, message: "Student not found" });

    return res.json({ success: true, message: "Counsellor assigned", data: student });
  } catch (err) {
    console.error("assignCounsellor error:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  getStudentDashboard,
  getDashboardStats,
  assignCounsellor,
};
const StudentAssignment = require("../models/Studentassignment");
const CourseModule = require("../models/CourseModule");
const StudentModuleProgress = require("../models/StudentModuleProgress");
const Attendance = require("../models/Attendance");
const Portfolio = require("../models/Portfolio");
const StudentInterview = require("../models/StudentInterview");
const StudentProfile = require("../models/Studentprofile");
const Fee = require("../models/Fee");
const User = require("../models/User");
const { resolveLiveClassInfo } = require("../utils/batchSchedule");

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const MIN_ATTENDANCE_REQUIRED = 75;

const round = (n) => Math.round(n * 10) / 10;

const startOfDayUTC = (d) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

// GET /api/student/portal-dashboard
const getPortalDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;

    const [user, assignment, profile, fee] = await Promise.all([
      User.findById(studentId).select("fullName"),
      StudentAssignment.findOne({ student: studentId, status: "active" })
        .populate("course", "title category")
        .populate("mentor", "fullName"),
      StudentProfile.findOne({ student: studentId }).lean(),
      Fee.findOne({ student: studentId }).lean(),
    ]);

    const courseId = assignment && assignment.course ? assignment.course._id : null;

    // ── Module progress ──
    let modulesSummary = { overallProgress: 0, completedCount: 0, totalCount: 0, roadmap: [] };
    if (courseId) {
      const [courseModules, progressDocs] = await Promise.all([
        CourseModule.find({ course: courseId }).sort({ order: 1 }).lean(),
        StudentModuleProgress.find({ student: studentId, course: courseId }).lean(),
      ]);

      const progressMap = new Map();
      for (let i = 0; i < progressDocs.length; i++) {
        progressMap.set(String(progressDocs[i].module), progressDocs[i]);
      }

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
        // Top 4 for the "Academic roadmap" card, prioritising in-progress/incomplete first
        roadmap: merged
          .slice()
          .sort((a, b) => (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0))
          .slice(0, 4),
      };
    }

    // ── Attendance: last 6 months trend + overall % ──
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const attendanceRecords = await Attendance.find({
      student: studentId,
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
      const pct = recs.length > 0 ? Math.round((presentCount / recs.length) * 100) : 0;
      return { month: label, attendance: pct };
    });

    const totalAttendanceRecords = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter((r) => r.status === "present").length;
    const attendancePercent = totalAttendanceRecords > 0 ? Math.round((totalPresent / totalAttendanceRecords) * 100) : 0;

    // ── 14-day activity streak ──
    // A day counts as "active" if the student had a present-attendance record
    // OR touched a module (lastAccess) on that date.
    const fourteenDaysAgo = startOfDayUTC(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));
    const recentAttendance = await Attendance.find({
      student: studentId,
      date: { $gte: fourteenDaysAgo },
      status: "present",
    }).select("date").lean();

    let recentModuleAccess = [];
    if (courseId) {
      recentModuleAccess = await StudentModuleProgress.find({
        student: studentId,
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
    let currentStreak = 0;
    for (let i = 13; i >= 0; i--) {
      const day = startOfDayUTC(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      const isActive = activeDateKeys.has(day.toISOString());
      streakDays.push(isActive);
    }
    // Count the current streak counting back from today
    for (let i = streakDays.length - 1; i >= 0; i--) {
      if (streakDays[i]) currentStreak++;
      else break;
    }

    // ── Portfolio ──
    const portfolioDocs = await Portfolio.find({ student: studentId }).select("status").lean();
    const portfolioApproved = portfolioDocs.filter((p) =>
      ["approved", "published"].includes(p.status)
    ).length;
    const portfolioInProgress = portfolioDocs.filter((p) => p.status === "draft" || p.status === "pending").length;
    const portfolioTarget = Math.max(portfolioDocs.length, 10); // sensible denominator until a target is configured elsewhere

    // ── Placement readiness (weighted composite score) ──
    const interviews = await StudentInterview.find({
      student: studentId,
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

    // ── Fees ──
    const feesPending = fee ? Math.max((fee.remainingAmount || 0), 0) : 0;
    const feeDueDate = fee ? fee.nextDueDate : null;

    // ── Next class ──
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

    // ── Stat cards ──
    const statCards = [
      {
        label: "Course Progress",
        value: `${modulesSummary.overallProgress}%`,
        note: `${modulesSummary.completedCount} of ${modulesSummary.totalCount} modules`,
        key: "course",
      },
      {
        label: "Attendance",
        value: `${attendancePercent}%`,
        note: `Min required ${MIN_ATTENDANCE_REQUIRED}%`,
        key: "attendance",
      },
      {
        label: "Portfolio Projects",
        value: `${portfolioApproved}/${portfolioTarget}`,
        note: `${portfolioInProgress} in progress`,
        key: "portfolio",
      },
      {
        label: "Placement Readiness",
        value: `${placementReadiness}%`,
        note: `${interviews.length} interview(s) lined up`,
        key: "placement",
      },
      {
        label: "Fees Pending",
        value: `₹${feesPending.toLocaleString("en-IN")}`,
        note: feeDueDate ? `Due ${new Date(feeDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : "No due date",
        key: "fees",
      },
      {
        label: "Next Class",
        value: nextClass ? `${nextClass.dateLabel} ${nextClass.timeLabel !== "—" ? nextClass.timeLabel.split(" - ")[0] : ""}`.trim() : "Not scheduled",
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

    return send(res, 200, true, "Dashboard fetched", {
      studentName: user ? user.fullName : "Student",
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
    console.error("getPortalDashboard error:", error);
    return send(res, 500, false, "Server error while fetching dashboard");
  }
};

module.exports = { getPortalDashboard };
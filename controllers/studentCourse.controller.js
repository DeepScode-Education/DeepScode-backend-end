const StudentAssignment = require("../models/Studentassignment");
const CourseModule = require("../models/CourseModule");
const StudentModuleProgress = require("../models/StudentModuleProgress");
const StudentProgressSnapshot = require("../models/StudentProgressSnapshot");
const { resolveLiveClassInfo } = require("../utils/batchSchedule");

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const scheduleLabelFromDays = (days) => {
  if (days === "SS") return "Weekend";
  if (days) return "Weekday";
  return "Not scheduled";
};

const computeOverallProgress = (modules) => {
  if (!modules.length) return 0;
  let total = 0;
  for (let i = 0; i < modules.length; i++) total += modules[i].progress;
  return Math.round(total / modules.length);
};

// GET /api/student/my-course
const getMyCourse = async (req, res) => {
  try {
    const studentId = req.user.id;

    const assignment = await StudentAssignment.findOne({ student: studentId, status: "active" })
      .populate("course", "title category duration level")
      .populate("mentor", "fullName rating studentsCount photoUrl");

    if (!assignment || !assignment.course) {
      return send(res, 404, false, "No course has been assigned to you yet. Please contact admin.");
    }

    const course = assignment.course;
    const mentor = assignment.mentor;

    // ── Modules: merge admin-defined CourseModule with student progress ──
    const [courseModules, progressDocs] = await Promise.all([
      CourseModule.find({ course: course._id }).sort({ order: 1 }).lean(),
      StudentModuleProgress.find({ student: studentId, course: course._id }).lean(),
    ]);

    const progressMap = new Map();
    for (let i = 0; i < progressDocs.length; i++) {
      progressMap.set(String(progressDocs[i].module), progressDocs[i]);
    }

    const modules = courseModules.map((mod) => {
      const p = progressMap.get(String(mod._id));
      if (p) {
        return {
          id: String(mod._id),
          order: mod.order,
          title: mod.title,
          status: p.status,
          progress: p.progress,
          lastAccess: p.lastAccess,
          feedback: p.feedback || null,
        };
      }
      return {
        id: String(mod._id),
        order: mod.order,
        title: mod.title,
        status: mod.defaultLocked ? "locked" : "in-progress",
        progress: 0,
        lastAccess: null,
        feedback: null,
      };
    });

    const overallProgress = computeOverallProgress(modules);

    // ── Progress history for the graph ──
    let history = await StudentProgressSnapshot.find({ student: studentId, course: course._id })
      .sort({ recordedAt: 1 })
      .select("weekLabel progress")
      .lean();

    if (history.length === 0) {
      history = [{ weekLabel: "Now", progress: overallProgress }];
    }

    const progressHistory = history.map((h) => ({ week: h.weekLabel, progress: h.progress }));

    // ── Live class info ──
    const batch = assignment.batch || {};
    const liveClass = resolveLiveClassInfo(
      batch.days || null,
      batch.time || null,
      mentor ? mentor.fullName : "TBA",
      batch.meetingLink || null
    );

    // ── Final response ──
    const overview = {
      title: course.title,
      batchCode: batch.batchCode || "Not assigned",
      scheduleLabel: scheduleLabelFromDays(batch.days),
      mentor: {
        name: mentor ? mentor.fullName : "Not assigned",
        rating: mentor && mentor.rating ? mentor.rating : 0,
        reviewsCount: mentor && mentor.studentsCount ? mentor.studentsCount : 0,
      },
      hoursInvested: assignment.hoursInvested || 0,
      hoursPerWeekAvg: assignment.hoursPerWeekAvg || 0,
    };

    return send(res, 200, true, "Course data fetched", {
      overview,
      modules,
      overallProgress,
      progressHistory,
      liveClass,
    });
  } catch (error) {
    console.error("getMyCourse error:", error);
    return send(res, 500, false, "Server error while fetching course data");
  }
};

module.exports = { getMyCourse };
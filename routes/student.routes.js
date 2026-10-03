const express = require("express");
const router = express.Router();
const upload = require("../middleware/Upload.middleware");
const { getMyCourse } = require("../controllers/studentCourse.controller");
const { getPortalDashboard } = require("../controllers/studentDashboard.controller");

const { getMyAttendance } = require("../controllers/studentAttendance.controller");


// ── OLD (delete karo) ──────────────────────────────────────────────────────────
// const auth = require("../middleware/auth.middleware");
// const admin = require("../middleware/admin.middleware");

// ── NEW ────────────────────────────────────────────────────────────────────────
const { auth, isAdmin, isStudent } = require("../middleware/auth.middleware");

const { getStudentDashboard, getDashboardStats } = require("../controllers/student.controller");
const { getMyProfile, saveProfile }              = require("../controllers/Studentprofile.controller");
const { getMyAssignment }                        = require("../controllers/Assignment.controller");
const { getMyFee }                               = require("../controllers/Fee.controller");
const { getMyPayments }                          = require("../controllers/Payment.controller");

const { getMyApplications } = require("../controllers/opportunityApplication.controller");


const {
  getMyVideos,
  getVideoById: getStudentVideoById,
  streamVideo: streamStudentVideo,
} = require("../controllers/studentVideo.controller");
// ── Dashboard ──────────────────────────────────────────────────────────────────
// isStudent = sirf students
// isAdmin   = sirf admin/super_admin
router.get("/dashboard",       auth, isStudent, getStudentDashboard);
router.get("/dashboard-stats", auth, isAdmin,   getDashboardStats);



// ── Profile ────────────────────────────────────────────────────────────────────
router.get("/profile", auth, isStudent, getMyProfile);
router.post("/profile", auth, isStudent, upload.single("govtIdImage"), saveProfile);
router.put("/profile",  auth, isStudent, upload.single("govtIdImage"), saveProfile);

// ── Assignment ─────────────────────────────────────────────────────────────────
router.get("/assignment", auth, isStudent, getMyAssignment);

// ── Fee ────────────────────────────────────────────────────────────────────────
router.get("/fee", auth, isStudent, getMyFee);

router.get("/my-course", auth, isStudent, getMyCourse);

router.get("/portal-dashboard", auth, isStudent, getPortalDashboard);

// ── Payments ───────────────────────────────────────────────────────────────────
router.get("/payment", auth, isStudent, getMyPayments);

router.get("/attendance", auth, getMyAttendance);

router.get("/opportunity-applications/mine", auth, getMyApplications);

router.get("/videos", auth, isStudent, getMyVideos);
router.get("/videos/:videoId", auth, isStudent, getStudentVideoById);
router.get("/videos/:videoId/stream", auth, isStudent, streamStudentVideo);

module.exports = router;
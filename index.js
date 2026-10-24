require("dotenv").config();

const registerProcessErrorHandlers = require("./utils/processHandlers");
const {
    errorHandler,
    notFoundHandler,
} = require("./middleware/errorHandler.middleware");
const { logInfo } = require("./utils/logger");
registerProcessErrorHandlers();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const enrollmentRoutes = require("./routes/enrollment.routes");
const adminRoutes = require("./routes/admin.routes");
const inquiryRoutes = require("./routes/inquiry.routes");
const studentRoutes = require("./routes/student.routes");
const mentorRoutes = require("./routes/Mentor.routes");
const emailOtpRoutes = require("./routes/emailOtp.routes");
const leadRoutes = require("./routes/lead.routes");
const staffRoutes = require("./routes/staff.routes");
const notificationRoutes = require("./routes/notification.routes");
const activityLogger = require("./middleware/activityLogger.middleware");

const heroRoutes = require("./routes/hero.routes");
const { connectRedis } = require("./config/redis");
const feeCollectionRoutes = require("./routes/feeCollection.routes");
const blogRoutes = require("./routes/blog.routes");
// ── NEW: destructure both routers from the updated course.routes.js ──────────
const {
    publicRouter: courseRoutes,
    adminRouter: adminCourseRouter,
} = require("./routes/course.routes");
const careerRoutes = require("./routes/career.routes");
const careerApplicationRoutes = require("./routes/careerApplication.routes");
const placementRoutes = require("./routes/placement.routes");
const testimonialRoutes = require("./routes/testimonial.routes");
const feeReportsRoutes = require("./routes/feeReports.routes");
const portfolioRoutes = require("./routes/portfolio.routes");
const adminPortfolioRoutes = require("./routes/adminPortfolio.routes");
const publicPortfolioRoutes = require("./routes/publicPortfolio.routes");
const studentDocumentRoutes = require("./routes/studentDocument.routes");
const adminStudentDocumentRoutes = require("./routes/adminStudentDocument.routes");
const assignmentSubmissionRoutes = require("./routes/assignmentSubmission.routes");
const mentorPortalRoutes = require("./routes/mentorPortal.routes");
const mentorProfileRoutes = require("./routes/mentorProfile.routes");
// ── NEW: Live Classroom Module (Zoom) ──────────────────────────────────────────
const { liveClassRoutes, registerLiveClassSockets } = require("./modules/live-class");
const { startAutoEndJob } = require("./modules/live-class/jobs/autoEndStaleClasses");
const phoneOtpRoutes = require("./routes/phoneOtp.routes");
const adminRecordedCourseRoutes = require("./routes/adminRecordedCourse.routes");
const categoryRoutes = require("./routes/category.routes");
const visitorRoutes = require("./routes/visitor.routes");
const permissionRoutes = require("./routes/permission.routes");
const adLeadRoutes = require("./routes/adLead.routes");

const {
  adminRouter: adminCertificateRoutes,
  studentRouter: studentCertificateRoutes,
  publicRouter: publicCertificateRoutes,
} = require("./routes/certificate.routes");

const supportTicketRoutes = require("./routes/supportTicket.routes");

const { adminRouter: adminOpportunityRoutes, publicRouter: opportunityRoutes } = require("./routes/opportunity.routes");
const { adminRouter: adminHiringPartnerRoutes } = require("./routes/hiringPartner.routes");
const visitorTracker = require("./middleware/visitorTracker.middleware");

const staffProfileRoutes = require("./routes/staffProfile.routes");
const staffAttendanceRoutes = require("./routes/staffAttendance.routes");
const staffLeaveRoutes = require("./routes/staffLeave.routes");
const staffDocumentRoutes = require("./routes/staffDocument.routes");
const payrollRoutes = require("./routes/payroll.routes");

// ── NEW: public-website route protection layer (Origin + Referer +
// User-Agent + per-IP rate limit). Applied only to intentionally public
// routers below — never to routes already gated by JWT auth. ─────────────────
const publicApiProtection = require("./middleware/publicApiProtection.middleware");

const app = express();

app.use(morgan("dev"));

// Database and Redis connections are started only by the executable server.
// This keeps importing the Express app side-effect free for tests and tooling.
if (require.main === module) {
    connectDB();
    connectRedis();
}

// ── Middlewares ────────────────────────────────────────────────────────────────

// ── NEW: CORS allowlist — production locked to the real website only,
// localhost dev origins only load outside production (NODE_ENV !== "production"). ──
const isProd = process.env.NODE_ENV === "production";

const PRODUCTION_ORIGINS = [
    "https://deep-scode-front-end.vercel.app",
    "https://www.deep-scode-front-end.vercel.app",
];
const DEV_ORIGINS = (
    process.env.DEV_ALLOWED_ORIGINS ||
    "http://localhost:5050,http://localhost:8080,http://localhost:8081,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://192.168.29.230:8080,"
)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const allowedOrigins = isProd
    ? PRODUCTION_ORIGINS
    : [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];

app.use(
    cors({
        origin: function(origin, callback) {
            // No Origin header (server-to-server calls, native clients) is still
            // allowed through this generic CORS layer — real protection for
            // sensitive routes is JWT auth + RBAC; for intentionally public
            // routes it's the publicApiProtection middleware applied below.
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
    }),
);
app.use(express.json());

// ── NEW: turn a rejected-origin CORS error into a clean generic 403 instead
// of leaking an Express default error page/stack trace. Must sit right
// after cors() so it only catches CORS errors, before any route logic runs. ──
app.use((err, req, res, next) => {
    if (err && err.message === "Not allowed by CORS") {
        return res.status(403).json({ success: false, message: "Access denied" });
    }
    next(err);
});

app.use(activityLogger);
app.use(visitorTracker);

app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
});

// Routes
app.use("/api/auth", authRoutes);

// ── Courses ──────────────────────────────────────────────────────────────────
// Public  → GET /api/courses        (listing with filters)
// Public  → GET /api/courses/:slug  (course detail)
app.use("/api/courses",  courseRoutes);

// Admin   → POST   /api/admin/courses
//         → PUT    /api/admin/courses/:id
//         → DELETE /api/admin/courses/:id
//         → PATCH  /api/admin/courses/:id/publish
//         → PATCH  /api/admin/courses/:id/feature
//         → PATCH  /api/admin/courses/:id/order
//         → GET    /api/admin/courses  (admin listing, includes unpublished)
app.use("/api/admin/courses", adminCourseRouter);

app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/admin", adminRoutes);

// ── Inquiries ──────────────────────────────────────────────────────────────────
// POST / is the public contact/inquiry form (protected inside the router
// itself via publicApiProtection). GET / and GET /:id are CRM lead data and
// require auth + isAdmin — see routes/inquiry.routes.js.
app.use("/api/inquiries", inquiryRoutes);

app.use("/api/student", studentRoutes);
app.use("/api/mentors", publicApiProtection, mentorRoutes);
app.use("/api/email-otp", publicApiProtection, emailOtpRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/hero", heroRoutes);
app.use("/api/fee-collection", feeCollectionRoutes);
app.use("/api/careers", publicApiProtection, careerRoutes);
app.use("/api/career-applications", publicApiProtection, careerApplicationRoutes);
app.use("/api/blogs",  blogRoutes);
app.use("/api/placements", publicApiProtection, placementRoutes);
app.use("/api/testimonials", publicApiProtection, testimonialRoutes);
app.use("/api/fee-reports", feeReportsRoutes);
app.use("/api/student/portfolio", portfolioRoutes);
app.use("/api/admin/portfolio", adminPortfolioRoutes);
app.use("/api/portfolio", publicApiProtection, publicPortfolioRoutes);
app.use("/api/student/documents", studentDocumentRoutes);
app.use("/api/admin/students", adminStudentDocumentRoutes);
app.use("/api/assignment-submissions", assignmentSubmissionRoutes);
app.use("/api/mentor", mentorPortalRoutes);
app.use("/api/admin/mentor-profile", mentorProfileRoutes);

// with your other app.use() calls:
app.use("/api/admin/certificates", adminCertificateRoutes);
app.use("/api/student/certificates", studentCertificateRoutes);
app.use("/api/verify", publicApiProtection, publicCertificateRoutes);
app.use("/api/phone-otp", publicApiProtection, phoneOtpRoutes);
app.use("/api/admin/opportunities", adminOpportunityRoutes);
app.use("/api/opportunities", publicApiProtection, opportunityRoutes);
app.use("/api/admin/hiring-partners", adminHiringPartnerRoutes);
app.use("/api/admin", adminRecordedCourseRoutes);
app.use("/api/support-tickets", supportTicketRoutes);
app.use("/api/categories", publicApiProtection, categoryRoutes);
// ── NEW: Live Classroom Module ────────────────────────────────────────────────
// POST /api/live/start /end /join
// GET  /api/live/current /history /upcoming
// POST /api/live/attendance/heartbeat
app.use("/api/live", liveClassRoutes);
app.use("/api/visitor", visitorRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/ad-leads", adLeadRoutes);
app.use("/api/staff-profile", staffProfileRoutes);
app.use("/api/staff-attendance", staffAttendanceRoutes);
app.use("/api/staff-leaves", staffLeaveRoutes);
app.use("/api/staff-documents", staffDocumentRoutes);
app.use("/api/payroll", payrollRoutes);

app.get("/", (req, res) => {
    res.send("Backend Running...");
});


app.use(notFoundHandler);
app.use(errorHandler);

// ── NEW: HTTP server + Socket.IO (needed for live-class real-time events) ────
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT;
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});
app.set('io', io); 

const createApp = () => app;

if (require.main === module) {
    registerLiveClassSockets(io);
    startAutoEndJob(io);

    httpServer.listen(PORT,"0.0.0.0", () => {
        logInfo(`Server running on port ${PORT}`);
    });
}

module.exports = { app, createApp };
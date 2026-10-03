const express = require("express");
const router = express.Router();

const { auth, isAdmin, isAccountant, isSuperAdmin } = require("../middleware/auth.middleware");

const {
  getDashboard,
  getAllStudents,
  getStudentDetails,
  getPendingStudents,
  approveStudent,
  rejectStudent,
  addStudent,
  deleteStudent,
  updateStudentProfile,
  assignFeeCollectionCounsellor,
} = require("../controllers/admin.controller");

const {
  assignCourseAndMentor,
} = require("../controllers/Assignment.controller");

const {
  getFeeByStudent,
  setupFee,
  getInstallments,      // ← NEW
  addInstallment,       // ← NEW
  updateInstallment,    // ← NEW
  deleteInstallment,    // ← NEW
} = require("../controllers/Fee.controller");



const {
  getPaymentsByStudent,
  addPayment,
  deletePayment ,
} = require("../controllers/Payment.controller");

const {
  getLeadSourceAnalytics,
  getCoursePerformance,
  getRevenueSeries,
} = require("../controllers/analytics.controller");
const { assignCounsellor } = require("../controllers/student.controller");

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get("/dashboard", auth, isAdmin, getDashboard);

//-CARRER

const {
  createCareer,
  getAdminCareers,
  getCareerById,
  updateCareer,
  deleteCareer,
  updateCareerStatus,
} = require("../controllers/career.controller");

const {
  createCareerRules,
  updateCareerRules,
  careerIdRules,
  deleteCareerRules,
  careerListRules,
 validate: validateBlog,
} = require("../validators/career.validator");

const uploadBlog = require("../middleware/blogUpload.middleware");

const {
  createBlog,
  getAdminBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  updateBlogStatus,
} = require("../controllers/blog.controller");

const {
  createBlogRules,
  updateBlogRules,
  blogIdRules,
  deleteBlogRules,
  blogListRules,
  validate,
} = require("../validators/blog.validator");

// ── Students ───────────────────────────────────────────────────────────────────
router.get("/students", auth, isAdmin, getAllStudents);
router.get("/students/pending", auth, isAdmin, getPendingStudents);
router.get("/students/:id", auth, isAdmin, getStudentDetails);
router.patch("/students/:id/approve", auth, isAdmin, approveStudent);
router.patch("/students/:id/reject", auth, isAdmin, rejectStudent);
router.post("/students", auth, isAdmin, addStudent);
// ── Assignment (course + mentor) ───────────────────────────────────────────────
router.patch("/students/:id/assign", auth, isAdmin, assignCourseAndMentor);

router.delete("/students/:id", auth, isAdmin, deleteStudent);
router.put("/students/:id/profile", auth, isAdmin, updateStudentProfile);

// ── Fee Plan ───────────────────────────────────────────────────────────────────
// isAccountant = accountant, admin, super_admin sabko allow karta hai
router.get("/students/:id/fee", auth, isAccountant, getFeeByStudent);
router.post("/students/:id/fee", auth, isAccountant, setupFee);
router.put("/students/:id/fee", auth, isAccountant, setupFee);

// ── NEW: EMI Installment Schedule ───────────────────────────────────────────────
router.get("/students/:id/fee/installments", auth, isAccountant, getInstallments);
router.post("/students/:id/fee/installments", auth, isAccountant, addInstallment);
router.put("/students/:id/fee/installments/:installmentId", auth, isAccountant, updateInstallment);
router.delete("/students/:id/fee/installments/:installmentId", auth, isAccountant, deleteInstallment);

// ── Payment Tracking ───────────────────────────────────────────────────────────
router.get("/students/:id/payment", auth, isAccountant, getPaymentsByStudent);
router.post("/students/:id/payment", auth, isAccountant, addPayment);
router.get("/analytics/lead-sources", auth, isAdmin, getLeadSourceAnalytics);

// Course Performance (converted leads → course count)
router.get(
  "/analytics/course-performance",
  auth,
  isAdmin,
  getCoursePerformance,
);

router.put(
  "/students/:studentId/assign-counsellor",
  auth,
  isAdmin,
  assignCounsellor,
);

router.get("/analytics/revenue-series", auth, isAdmin, getRevenueSeries);

// Create Career
router.post(
  "/careers",
  auth,
  isAdmin,
  createCareerRules,
  validate,
  createCareer,
);

// Get All Careers (Admin)
router.get(
  "/careers",
  auth,
  isAdmin,
  careerListRules,
  validate,
  getAdminCareers,
);

router.patch(
  "/students/:id/assign-fee-collection",
  auth,
  isAdmin,
  assignFeeCollectionCounsellor
);

// Get Single Career
router.get(
  "/careers/:id",
  auth,
  isAdmin,
  careerIdRules,
  validate,
  getCareerById,
);

// Update Career
router.put(
  "/careers/:id",
  auth,
  isAdmin,
  updateCareerRules,
  validate,
  updateCareer,
);

// Delete Career
router.delete(
  "/careers/:id",
  auth,
  isAdmin,
  deleteCareerRules,
  validate,
  deleteCareer,
);

// Publish / Draft / Closed
router.patch(
  "/careers/:id/status",
  auth,
  isAdmin,
  careerIdRules,
  validate,
  updateCareerStatus,
);

router.post(
  "/blogs",
  auth,
  isAdmin,
  uploadBlog.single("thumbnail"),
  createBlogRules,
  validateBlog,
  createBlog,
);

router.get("/blogs", auth, isAdmin, blogListRules, validateBlog, getAdminBlogs);

router.get("/blogs/:id", auth, isAdmin, blogIdRules, validate, getBlogById);

router.put(
  "/blogs/:id",
  auth,
  isAdmin,
  uploadBlog.single("thumbnail"),
  updateBlogRules,
  validateBlog,
  updateBlog,
);

router.delete(
  "/blogs/:id",
  auth,
  isAdmin,
  deleteBlogRules,
  validateBlog,
  deleteBlog,
);

router.patch(
  "/blogs/:id/status",
  auth,
  isAdmin,
  blogIdRules,
  validateBlog,
  updateBlogStatus,
);
router.delete("/students/:id/payment/:paymentId", auth, isSuperAdmin, deletePayment);

module.exports = router;
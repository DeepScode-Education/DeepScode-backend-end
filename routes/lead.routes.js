const express = require("express");
const router  = express.Router();

const { auth } = require("../middleware/auth.middleware");

const { isCounsellor, isAdminOrSuper } = require("../middleware/roles.middleware");

const {
  createLead,              // NEW
  getAllLeads,
  getLeadById,
  exportLeads,
  updateLeadStatus,
  assignLead,
  updateLeadInfo,
  updateObjections,
  addDocument,
  removeDocument,
  createFollowUp,
  getFollowUps,
  getLeadDashboard,
  getAllFollowUps,
  updateLeadPriority,
  updateDemoInfo,
  updatePaymentPlan,
  updateParentInfo,
  getFeeHistory,
  convertToStudent,
  requestConversion,
  approveConversionRequest,
  rejectConversionRequest,
  getPendingConversionRequests,
  markLeadLost,
  checkDuplicates,
  mergeLeads,
  getLeadTimeline,
  getStatusHistory,
  getAssignmentHistory,
  getCounsellorAnalytics,
  updateLeadDetails,
  deleteLead,
  assignFeeCollectionCounsellor,
  bulkDeleteLeads,
  bulkAssignLeads,
  getDashboardPendingFollowUps,
} = require("../controllers/lead.controller");

// All lead routes require auth + (counsellor|admin|super_admin) at minimum.
router.use(auth);

// ── Dashboard / list / search ───────────────────────────────────────────────────
router.get("/dashboard",              isCounsellor, getLeadDashboard);
router.get("/followups/all",          isCounsellor, getAllFollowUps);
router.get("/duplicates/check",       isCounsellor, checkDuplicates);
router.get("/analytics/counsellor",   isCounsellor, getCounsellorAnalytics);

// ── Conversion requests (admin/super_admin review queue) ───────────────────────
router.get("/conversion-requests/pending", isAdminOrSuper, getPendingConversionRequests);

router.get("/",      isCounsellor, getAllLeads);
router.post("/",     isCounsellor, createLead);      // NEW — counsellors + admins can create
router.post("/merge", isAdminOrSuper, mergeLeads);


router.get("/export", isAdminOrSuper, exportLeads);
// router.get("/:id", isAdminOrSuper, getLeadById);

// ── Single lead ──────────────────────────────────────────────────────────────────
router.get("/:id",                 isCounsellor, getLeadById);
router.patch("/:id/status",        isCounsellor, updateLeadStatus);
router.patch("/:id/assign",        isAdminOrSuper, assignLead);          // admin/super_admin only
router.patch("/:id/priority",      isCounsellor, updateLeadPriority);
router.patch("/:id/demo",          isCounsellor, updateDemoInfo);
router.patch("/:id/payment-plan",  isCounsellor, updatePaymentPlan);
router.patch("/:id/parent-info",   isCounsellor, updateParentInfo);
router.patch("/:id/info",          isCounsellor, updateLeadInfo);
router.patch("/:id/details",       isCounsellor, updateLeadDetails);
router.patch("/:id/objections",    isCounsellor, updateObjections);

router.post("/:id/documents",            isCounsellor, addDocument);
router.delete("/:id/documents/:docId",   isCounsellor, removeDocument);

router.post("/:id/followups", isCounsellor, createFollowUp);
router.get("/:id/followups",  isCounsellor, getFollowUps);

router.get("/:id/timeline",        isCounsellor, getLeadTimeline);
router.get("/:id/fee-history",     isCounsellor, getFeeHistory);
router.get("/:id/status-history",  isCounsellor, getStatusHistory);
router.get("/:id/assign-history",  isCounsellor, getAssignmentHistory);

router.post("/:id/lost", isCounsellor, markLeadLost);

// ── Conversion workflow ─────────────────────────────────────────────────────────
router.post("/:id/conversion-request", isCounsellor, requestConversion);
router.patch("/:id/conversion-request/approve", isAdminOrSuper, approveConversionRequest);
router.patch("/:id/conversion-request/reject",  isAdminOrSuper, rejectConversionRequest);

// Backward-compat: old frontend calling POST /:id/convert still works.
router.post("/:id/convert", isCounsellor, convertToStudent);

// ── Destructive — admin/super_admin only ────────────────────────────────────────
router.delete("/:id", isAdminOrSuper, deleteLead);
router.patch("/:id/assign-fee-collection", isAdminOrSuper, assignFeeCollectionCounsellor);

router.post("/bulk-delete", isAdminOrSuper, bulkDeleteLeads);
router.patch("/bulk-assign", isAdminOrSuper, bulkAssignLeads);

router.get("/followups/dashboard-pending", isCounsellor, getDashboardPendingFollowUps); 


module.exports = router;
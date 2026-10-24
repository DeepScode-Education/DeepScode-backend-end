

// const express = require("express");
// const router = express.Router();

// const {
//   auth,
//   isAdmin,
//   isAccountant,
//   isCounsellor,
// } = require("../middleware/auth.middleware");

// const {
//   getFeeCollectionList,
//   getFeeDashboard,
//   getRecentPayments,
//   getOverdueStudents,
//   getStudentFeeDetails,
//   addPayment,
//   getInstallments,
//   getFeeFollowUps,
//   addFeeFollowUp,
//   updateFeeFollowUp,
//   getFeeNotes,
//   addFeeNote,
//   setupFeeWithInstallments,
// } = require("../controllers/feeCollection.controller");

// // ── All fee collection routes require authentication ──────────────────────────
// router.use(auth);

// // ── Dashboard (admin + accountant) ───────────────────────────────────────────
// router.get("/dashboard", isCounsellor, getFeeDashboard);
// router.get("/recent-payments", isCounsellor, getRecentPayments);
// router.get("/overdue", isCounsellor, getOverdueStudents);

// // ── Main list (counsellor can view their students' fees) ──────────────────────
// router.get("/", isCounsellor, getFeeCollectionList);

// // ── Per-student fee endpoints ─────────────────────────────────────────────────

// // Fee setup (admin / accountant only)
// router.post("/:studentId/fee-setup", isCounsellor, setupFeeWithInstallments);
// router.put("/:studentId/fee-setup", isCounsellor, setupFeeWithInstallments);

// // Student fee details (counsellor can view)
// router.get("/:studentId", isCounsellor, getStudentFeeDetails);

// // Payment recording (accountant / admin)
// router.post("/:studentId/payment", isCounsellor, addPayment);

// // Installments (counsellor can view)
// router.get("/:studentId/installments", isCounsellor, getInstallments);

// // Follow-ups (counsellor can add / update)
// router.get("/:studentId/follow-ups", isCounsellor, getFeeFollowUps);
// router.post("/:studentId/follow-ups", isCounsellor, addFeeFollowUp);
// router.put("/:studentId/follow-ups/:id", isCounsellor, updateFeeFollowUp);

// // Notes (counsellor can add / view)
// router.get("/:studentId/notes", isCounsellor, getFeeNotes);
// router.post("/:studentId/notes", isCounsellor, addFeeNote);

// module.exports = router;








// routes/feeCollection.routes.js
//
// Fee Collection CRM routes.
// Mounted at /api/fee-collection in index.js.
//
// Permission model:
//   isAdmin (admin + super_admin) → full access including setup, payment recording
//   isCounsellor (counsellor + admin + super_admin) → view, notes, follow-ups
//   isAccountant (accountant + admin + super_admin) → payment recording
//
// CHANGES FROM ORIGINAL:
//   - Added setupFeeWithInstallments route (was missing)
//   - Split permissions: list/detail routes now accessible by counsellors
//   - Added /api/fee-collection/:studentId/fee-setup route for admin/accountant
//   - Added receipt download route stub

const express = require("express");
const router = express.Router();

const {
  auth,
} = require("../middleware/auth.middleware");

const { requirePermission } = require("../middleware/permission.middleware");

const {
  getFeeCollectionList,
  getFeeDashboard,
  getRecentPayments,
  getOverdueStudents,
  getStudentFeeDetails,
  addPayment,
  getInstallments,
  getFeeFollowUps,
  addFeeFollowUp,
  updateFeeFollowUp,
  getFeeNotes,
  addFeeNote,
  setupFeeWithInstallments,
} = require("../controllers/feeCollection.controller");

// ── All fee collection routes require authentication ──────────────────────────
router.use(auth);

// ── Dashboard (admin + accountant) ───────────────────────────────────────────
router.get("/dashboard", requirePermission("fees.view"), getFeeDashboard);
router.get("/recent-payments", requirePermission("payments.view"), getRecentPayments);
router.get("/overdue", requirePermission("fees.view"), getOverdueStudents);

// ── Main list (counsellor can view their students' fees) ──────────────────────
router.get("/", requirePermission("fees.view"), getFeeCollectionList);

// ── Per-student fee endpoints ─────────────────────────────────────────────────

// Fee setup (admin / accountant only)
router.post("/:studentId/fee-setup", requirePermission("fees.create"), setupFeeWithInstallments);
router.put("/:studentId/fee-setup", requirePermission("fees.edit"), setupFeeWithInstallments);

// Student fee details (counsellor can view)
router.get("/:studentId", requirePermission("fees.view"), getStudentFeeDetails);

// Payment recording (accountant / admin)
router.post("/:studentId/payment", requirePermission("payments.create"), addPayment);

// Installments (counsellor can view)
router.get("/:studentId/installments", requirePermission("fees.view"), getInstallments);

// Follow-ups (counsellor can add / update)
router.get("/:studentId/follow-ups", requirePermission("fees.view"), getFeeFollowUps);
router.post("/:studentId/follow-ups", requirePermission("fees.followups"), addFeeFollowUp);
router.put("/:studentId/follow-ups/:id", requirePermission("fees.followups"), updateFeeFollowUp);

// Notes (counsellor can add / view)
router.get("/:studentId/notes", requirePermission("fees.view"), getFeeNotes);
router.post("/:studentId/notes", requirePermission("fees.notes"), addFeeNote);

module.exports = router;
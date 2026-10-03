// routes/supportTicket.routes.js
const express = require("express");
const router = express.Router();

const { auth, isAdmin, optionalAuth } = require("../middleware/auth.middleware");

const {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketById,
  getAllSupportTickets,
  updateSupportTicket,
  updateSupportTicketStatus,
  updateSupportTicketPriority,
  assignSupportTicket,
  replyToSupportTicket,
  createInquiryFromSupportTicket,
} = require("../controllers/supportTicket.controller");

const {
  createSupportTicketRules,
  replyRules,
  statusRules,
  priorityRules,
  assignRules,
  ticketIdRules,
  listRules,
  validate,
} = require("../validators/supportTicket.validator");

// ── Create — public form + logged-in users (optionalAuth, same pattern as
// routes/inquiry.routes.js) ─────────────────────────────────────────────────
router.post("/", optionalAuth, createSupportTicketRules, validate, createSupportTicket);

// ── Logged-in user's own tickets ────────────────────────────────────────────
router.get("/my", auth, getMySupportTickets);

// ── Admin — registered before "/:id" so "admin" is never swallowed as a
// ticket ID param ───────────────────────────────────────────────────────────
router.get("/admin", auth, isAdmin, listRules, validate, getAllSupportTickets);
router.get("/admin/:id", auth, isAdmin, ticketIdRules, validate, getSupportTicketById);
router.put("/admin/:id", auth, isAdmin, ticketIdRules, validate, updateSupportTicket);
router.patch("/admin/:id/status", auth, isAdmin, ticketIdRules, statusRules, validate, updateSupportTicketStatus);
router.patch("/admin/:id/priority", auth, isAdmin, ticketIdRules, priorityRules, validate, updateSupportTicketPriority);
router.patch("/admin/:id/assign", auth, isAdmin, ticketIdRules, assignRules, validate, assignSupportTicket);
router.post("/admin/:id/reply", auth, isAdmin, ticketIdRules, replyRules, validate, replyToSupportTicket);
router.post(
  "/admin/:id/convert-to-inquiry",
  auth,
  isAdmin,
  ticketIdRules,
  validate,
  createInquiryFromSupportTicket
);

// ── Single ticket — owner or admin (controller enforces authorization) ─────
router.get("/:id", auth, ticketIdRules, validate, getSupportTicketById);

module.exports = router;
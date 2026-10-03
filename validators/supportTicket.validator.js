// validators/supportTicket.validator.js
const { body, param, query, validationResult } = require("express-validator");

const ISSUE_TYPE_MAX = 100;
const SUBJECT_MAX = 150;
const DESCRIPTION_MAX = 3000;

// ── POST /api/support-tickets ──────────────────────────────────────────────
const createSupportTicketRules = [
  body("issueType")
    .trim()
    .notEmpty().withMessage("Issue type is required")
    .isLength({ max: ISSUE_TYPE_MAX }).withMessage(`Issue type cannot exceed ${ISSUE_TYPE_MAX} characters`),

  body("subject")
    .trim()
    .notEmpty().withMessage("Subject is required")
    .isLength({ max: SUBJECT_MAX }).withMessage(`Subject cannot exceed ${SUBJECT_MAX} characters`),

  body("description")
    .trim()
    .notEmpty().withMessage("Description is required")
    .isLength({ max: DESCRIPTION_MAX }).withMessage(`Description cannot exceed ${DESCRIPTION_MAX} characters`),

  body("fullName")
    .trim()
    .notEmpty().withMessage("Full name is required")
    .isLength({ max: 100 }).withMessage("Full name cannot exceed 100 characters"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Enter a valid email address")
    .normalizeEmail(),

  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage("Enter a valid 10-digit mobile number"),

  body("studentId")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 }).withMessage("Student ID is too long"),
];

// ── POST /api/support-tickets/admin/:id/reply ───────────────────────────────
const replyRules = [
  body("reply")
    .trim()
    .notEmpty().withMessage("Reply content is required")
    .isLength({ max: 5000 }).withMessage("Reply cannot exceed 5000 characters"),
  body("status")
    .optional()
    .isIn(["open", "in-progress", "resolved", "closed"]).withMessage("Invalid status value"),
];

// ── PATCH /api/support-tickets/admin/:id/status ─────────────────────────────
const statusRules = [
  body("status")
    .notEmpty().withMessage("Status is required")
    .isIn(["open", "in-progress", "resolved", "closed"]).withMessage("Invalid status value"),
];

// ── PATCH /api/support-tickets/admin/:id/priority ───────────────────────────
const priorityRules = [
  body("priority")
    .notEmpty().withMessage("Priority is required")
    .isIn(["low", "medium", "high", "urgent"]).withMessage("Invalid priority value"),
];

// ── PATCH /api/support-tickets/admin/:id/assign ─────────────────────────────
const assignRules = [
  body("assignedTo")
    .optional({ nullable: true })
    .isMongoId().withMessage("Invalid assignedTo user ID"),
];

const ticketIdRules = [
  param("id").isMongoId().withMessage("Invalid ticket ID"),
];

const listRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status").optional().isIn(["open", "in-progress", "resolved", "closed"]),
  query("priority").optional().isIn(["low", "medium", "high", "urgent"]),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = {
  createSupportTicketRules,
  replyRules,
  statusRules,
  priorityRules,
  assignRules,
  ticketIdRules,
  listRules,
  validate,
};
// controllers/supportTicket.controller.js
const mongoose = require("mongoose");

const SupportTicket = require("../models/SupportTicket");
const User = require("../models/User");
const Inquiry = require("../models/Inquiry");
const Course = require("../models/Course");
const {
  generateTicketNumber,
  sendAdminTicketEmail,
  sendUserConfirmationEmail,
  sendReplyEmail,
} = require("../services/supportTicket.service");
const { notify } = require("../utils/notify");

// ── Helpers — same shape used across the rest of the codebase
// (feeCollection.controller.js, mentorPortal.controller.js, etc.) ──────────
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

// Roles a ticket may be assigned to — every staff role, admin included.
const ASSIGNABLE_ROLES = ["super_admin", "admin", "counsellor", "mentor", "accountant"];
const VALID_STATUSES = SupportTicket.STATUSES;
const VALID_PRIORITIES = SupportTicket.PRIORITIES;

// ── POST /api/support-tickets ──────────────────────────────────────────────
// Public + logged-in. Guests allowed (per the existing Inquiry public-form
// pattern). For authenticated users, identity (email/link) is always taken
// from the database record, never blindly trusted from the request body.
const createSupportTicket = async (req, res) => {
  try {
    const { issueType, subject, description, phone, studentId } = req.body;
    let { fullName, email } = req.body;

    let userDoc = null;
    let userId = null;

    if (req.user && req.user.id) {
      userDoc = await User.findById(req.user.id).select("fullName email phone studentId");
      if (userDoc) {
        userId = userDoc._id;
        // Trust the DB for the authenticated identity — never the frontend.
        email = userDoc.email;
        fullName = (fullName && fullName.trim()) || userDoc.fullName;
      }
    }

    if (!email) {
      return send(res, 400, false, "Email is required");
    }
    if (!fullName || !fullName.trim()) {
      return send(res, 400, false, "Full name is required");
    }

    const ticketNumber = await generateTicketNumber();

    let ticket;
    try {
      ticket = await SupportTicket.create({
        ticketNumber,
        user: userId,
        issueType: issueType.trim(),
        subject: subject.trim(),
        description: description.trim(),
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: (phone && phone.trim()) || (userDoc && userDoc.phone) || "",
        studentId: (studentId && studentId.trim()) || (userDoc && userDoc.studentId) || "",
      });
    } catch (createErr) {
      // Duplicate ticketNumber is effectively impossible (atomic counter),
      // but if it ever happens, retry once with a freshly generated number
      // rather than failing the whole request.
      if (createErr.code === 11000 && createErr.keyPattern && createErr.keyPattern.ticketNumber) {
        const retryNumber = await generateTicketNumber();
        ticket = await SupportTicket.create({
          ticketNumber: retryNumber,
          user: userId,
          issueType: issueType.trim(),
          subject: subject.trim(),
          description: description.trim(),
          fullName: fullName.trim(),
          email: email.toLowerCase().trim(),
          phone: (phone && phone.trim()) || (userDoc && userDoc.phone) || "",
          studentId: (studentId && studentId.trim()) || (userDoc && userDoc.studentId) || "",
        });
      } else {
        throw createErr;
      }
    }

    // Database write already succeeded — email delivery is best-effort and
    // must never fail the API response. Failures are logged, not thrown.
    Promise.all([sendAdminTicketEmail(ticket), sendUserConfirmationEmail(ticket)]).catch((err) => {
      console.error(`[createSupportTicket] email dispatch error for ${ticket.ticketNumber}:`, err.message);
    });

    // In-app notification to admins (best-effort, fire-and-forget).
    User.find({ role: { $in: ["admin", "super_admin"] }, isActive: true })
      .select("_id")
      .then((admins) => {
        admins.forEach((admin) => {
          notify({
            userId: admin._id,
            type: "support_ticket_created",
            title: "New support ticket",
            body: `${ticket.subject} — ${ticket.ticketNumber}`,
            link: `/admin/support-tickets/${ticket._id}`,
            relatedResource: "SupportTicket",
            relatedResourceId: ticket._id,
          });
        });
      })
      .catch((err) => console.error("[createSupportTicket] admin notify lookup failed:", err.message));

    return send(res, 201, true, "Support ticket submitted successfully", ticket);
  } catch (error) {
    console.error("createSupportTicket error:", error);
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((e) => e.message)
        .join(". ");
      return send(res, 400, false, message);
    }
    return send(res, 500, false, "Server error while creating support ticket");
  }
};

// ── GET /api/support-tickets/my ────────────────────────────────────────────
const getMySupportTickets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = { user: req.user.id };
    if (status) filter.status = status;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate("assignedTo", "fullName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SupportTicket.countDocuments(filter),
    ]);

    return send(res, 200, true, "Support tickets fetched", tickets, {
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getMySupportTickets error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/support-tickets/:id  AND  /api/support-tickets/admin/:id ──────
// Owner or admin. A normal user may only view their own ticket; admin can
// view any ticket. Shared by both routes since the authorization check is
// identical either way.
const getSupportTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const ticket = await SupportTicket.findById(id)
      .populate("user", "fullName email studentId")
      .populate("assignedTo", "fullName role")
      .populate("inquiry", "fullName leadStatus");

    if (!ticket) return send(res, 404, false, "Support ticket not found");

    const isOwner = ticket.user && String(ticket.user._id) === String(req.user.id);
    const isAdminRole = ["admin", "super_admin"].includes(req.user.role);

    if (!isOwner && !isAdminRole) {
      return send(res, 403, false, "You cannot view this ticket");
    }

    return send(res, 200, true, "Support ticket fetched", ticket);
  } catch (error) {
    console.error("getSupportTicketById error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── GET /api/support-tickets/admin ─────────────────────────────────────────
// Admin listing — pagination, search, filtering.
const getAllSupportTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      priority = "",
      issueType = "",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (issueType) filter.issueType = issueType;

    if (search.trim()) {
      const regex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { ticketNumber: regex },
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { studentId: regex },
        { subject: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate("user", "fullName email studentId")
        .populate("assignedTo", "fullName role")
        .populate("inquiry", "fullName leadStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SupportTicket.countDocuments(filter),
    ]);

    return send(res, 200, true, "Support tickets fetched", tickets, {
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAllSupportTickets error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PUT /api/support-tickets/admin/:id ─────────────────────────────────────
// Generic field update (subject/description/issueType/priority/status).
const updateSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const { subject, description, issueType, priority, status } = req.body;
    const update = {};

    if (subject !== undefined) update.subject = subject.trim();
    if (description !== undefined) update.description = description.trim();
    if (issueType !== undefined) update.issueType = issueType.trim();

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return send(res, 400, false, `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
      }
      update.priority = priority;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return send(res, 400, false, `Status must be one of: ${VALID_STATUSES.join(", ")}`);
      }
      update.status = status;
      update.resolvedAt = status === "resolved" ? new Date() : null;
    }

    const ticket = await SupportTicket.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .populate("user", "fullName email studentId")
      .populate("assignedTo", "fullName role");

    if (!ticket) return send(res, 404, false, "Support ticket not found");

    return send(res, 200, true, "Support ticket updated", ticket);
  } catch (error) {
    console.error("updateSupportTicket error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/support-tickets/admin/:id/status ─────────────────────────────
// resolvedAt is auto-managed: set when moving into "resolved", cleared when
// moving back out of it.
const updateSupportTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return send(res, 400, false, `Status must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return send(res, 404, false, "Support ticket not found");

    const prevStatus = ticket.status;
    ticket.status = status;

    if (status === "resolved") {
      ticket.resolvedAt = new Date();
    } else if (prevStatus === "resolved" && status !== "resolved") {
      ticket.resolvedAt = null;
    }

    await ticket.save();

    return send(res, 200, true, "Ticket status updated", ticket);
  } catch (error) {
    console.error("updateSupportTicketStatus error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/support-tickets/admin/:id/priority ───────────────────────────
const updateSupportTicketPriority = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const { priority } = req.body;
    if (!VALID_PRIORITIES.includes(priority)) {
      return send(res, 400, false, `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
    }

    const ticket = await SupportTicket.findByIdAndUpdate(id, { priority }, { new: true });
    if (!ticket) return send(res, 404, false, "Support ticket not found");

    return send(res, 200, true, "Ticket priority updated", ticket);
  } catch (error) {
    console.error("updateSupportTicketPriority error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/support-tickets/admin/:id/assign ─────────────────────────────
// body: { assignedTo: userId | null }  — null/omitted clears the assignment.
const assignSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const { assignedTo } = req.body;

    let assignee = null;
    if (assignedTo) {
      if (!isValidId(assignedTo)) return send(res, 400, false, "Invalid assignedTo user ID");
      assignee = await User.findOne({ _id: assignedTo, role: { $in: ASSIGNABLE_ROLES }, isActive: true });
      if (!assignee) return send(res, 400, false, "Assigned user must be an active staff member");
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { assignedTo: assignee ? assignee._id : null },
      { new: true }
    ).populate("assignedTo", "fullName role");

    if (!ticket) return send(res, 404, false, "Support ticket not found");

    if (assignee) {
      notify({
        userId: assignee._id,
        type: "support_ticket_assigned",
        title: "Support ticket assigned to you",
        body: `${ticket.subject} — ${ticket.ticketNumber}`,
        link: `/admin/support-tickets/${ticket._id}`,
        relatedResource: "SupportTicket",
        relatedResourceId: ticket._id,
      });
    }

    return send(res, 200, true, "Ticket assignment updated", ticket);
  } catch (error) {
    console.error("assignSupportTicket error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── POST /api/support-tickets/admin/:id/reply ───────────────────────────────
const replyToSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const { reply, status } = req.body;
    if (!reply || !reply.trim()) {
      return send(res, 400, false, "Reply content is required");
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return send(res, 404, false, "Support ticket not found");

    ticket.adminReply = reply.trim();

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return send(res, 400, false, `Status must be one of: ${VALID_STATUSES.join(", ")}`);
      }
      const prevStatus = ticket.status;
      ticket.status = status;
      if (status === "resolved") ticket.resolvedAt = new Date();
      else if (prevStatus === "resolved") ticket.resolvedAt = null;
    } else if (ticket.status === "open") {
      // A reply naturally moves an untouched ticket forward — doesn't
      // override an explicit status the admin already set.
      ticket.status = "in-progress";
    }

    await ticket.save();

    sendReplyEmail(ticket).catch((err) => {
      console.error(`[replyToSupportTicket] email dispatch error for ${ticket.ticketNumber}:`, err.message);
    });

    if (ticket.user) {
      notify({
        userId: ticket.user,
        type: "support_ticket_reply",
        title: "Reply to your support ticket",
        body: `${ticket.ticketNumber}: ${reply.trim().slice(0, 100)}`,
        link: `/student/support-tickets/${ticket._id}`,
        relatedResource: "SupportTicket",
        relatedResourceId: ticket._id,
      });
    }

    const populated = await SupportTicket.findById(id)
      .populate("user", "fullName email studentId")
      .populate("assignedTo", "fullName role");

    return send(res, 200, true, "Reply sent successfully", populated);
  } catch (error) {
    console.error("replyToSupportTicket error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── POST /api/support-tickets/admin/:id/convert-to-inquiry ─────────────────
// body: { course, mobileNumber?, remarks? }
//
// Inquiry.course is a required reference in the existing Inquiry schema,
// and Support Tickets have no course field of their own — so the admin
// must supply the target course at conversion time. mobileNumber is also
// required by Inquiry; falls back to ticket.phone if present, otherwise
// the admin must supply it explicitly.
const createInquiryFromSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ticket ID");

    const { course, mobileNumber, remarks } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return send(res, 404, false, "Support ticket not found");

    // Duplicate-inquiry guard — return the existing inquiry instead of
    // creating another one.
    if (ticket.inquiry) {
      const existingInquiry = await Inquiry.findById(ticket.inquiry);
      if (existingInquiry) {
        return send(res, 200, true, "This ticket already has a linked inquiry", {
          ticket,
          inquiry: existingInquiry,
        });
      }
    }

    if (!course || !isValidId(course)) {
      return send(res, 400, false, "A valid 'course' is required to convert this ticket into an inquiry");
    }
    const courseDoc = await Course.findById(course).select("_id");
    if (!courseDoc) return send(res, 400, false, "Selected course does not exist");

    const resolvedMobile = ((mobileNumber || ticket.phone) || "").trim();
    if (!/^[6-9]\d{9}$/.test(resolvedMobile)) {
      return send(
        res,
        400,
        false,
        "A valid 10-digit mobile number is required to create an inquiry — this ticket has none on file, pass 'mobileNumber'"
      );
    }

    // Same duplicate-lead check the existing public Inquiry flow uses
    // (inquiry.controller.js:createInquiry) — email + course.
    const normalizedEmail = ticket.email ? ticket.email.toLowerCase().trim() : undefined;
    if (normalizedEmail) {
      const existingByEmail = await Inquiry.findOne({ email: normalizedEmail, course: courseDoc._id });
      if (existingByEmail) {
        ticket.inquiry = existingByEmail._id;
        await ticket.save();
        return send(res, 200, true, "An existing inquiry for this email/course was linked instead", {
          ticket,
          inquiry: existingByEmail,
        });
      }
    }

    const inquiry = await Inquiry.create({
      fullName: ticket.fullName,
      mobileNumber: resolvedMobile,
      email: normalizedEmail,
      course: courseDoc._id,
      source: "Support Ticket",
      remarks: remarks || `Created from support ticket ${ticket.ticketNumber}`,
      createdBy: req.user.id,
      createdByRole: req.user.role,
    });

    ticket.inquiry = inquiry._id;
    await ticket.save();

    return send(res, 201, true, "Inquiry created from support ticket", { ticket, inquiry });
  } catch (error) {
    console.error("createInquiryFromSupportTicket error:", error);
    if (error.code === 11000) {
      return send(res, 409, false, "Duplicate inquiry detected");
    }
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
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
};
// services/supportTicket.service.js
//
// Encapsulates the two non-trivial pieces of the Support Ticket feature:
//   1. Safe, concurrency-proof ticket number generation
//   2. Resend email templates (admin notification, user confirmation, reply)
//
// Follows the same Resend usage pattern already used throughout this
// codebase (controllers/auth.controller.js, controllers/emailOtp.controller.js,
// controllers/admin.controller.js, etc.): a local `new Resend(...)` instance
// reading from the existing RESEND_API_KEY / RESEND_FROM_EMAIL env vars.
// No second/duplicate Resend configuration is introduced — same package,
// same env vars, same call shape as the rest of the app.

const { Resend } = require("resend");
const TicketCounter = require("../models/TicketCounter");

const resend = new Resend(process.env.RESEND_API_KEY);

// Where new-ticket notifications go. Overridable via env without a code
// change; falls back to the address given in the spec.
const ADMIN_NOTIFY_EMAIL = process.env.SUPPORT_TICKET_ADMIN_EMAIL || "info@deepScode.com";

// ── Ticket number generation ────────────────────────────────────────────────
// Format: deepScodeYYYYMMDD-XXXX (4-digit, zero-padded, resets daily).
// findOneAndUpdate + $inc + upsert is an atomic MongoDB operation, so two
// concurrent ticket creations on the same day can never receive the same
// sequence number — no separate locking/transactions required.
const generateTicketNumber = async () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateKey = `${y}${m}${d}`;

  const counter = await TicketCounter.findOneAndUpdate(
    { _id: dateKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `deepScode${dateKey}-${String(counter.seq).padStart(4, "0")}`;
};

// ── Small HTML escape — the codebase's existing email templates don't
// escape interpolated values either, but ticket subject/description are
// free-text from a public-facing form, so it's worth the few extra lines.
const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const wrapEmail = (title, bodyHtml) => `
  <div style="font-family:sans-serif; max-width:560px; margin:0 auto;">
    <h2 style="color:#0037FF;">${escapeHtml(title)}</h2>
    ${bodyHtml}
    <p style="margin-top:24px; font-size:12px; color:#888;">DeepScode Support</p>
  </div>
`;

const infoRow = (label, value) =>
  `<tr><td style="padding:4px 8px 4px 0; white-space:nowrap;"><strong>${escapeHtml(label)}:</strong></td><td>${escapeHtml(value || "-")}</td></tr>`;

// ── Admin notification email — sent to info@deepScode.com on creation ──
const sendAdminTicketEmail = async (ticket) => {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `[Support Ticket] ${ticket.ticketNumber} - ${ticket.subject}`,
      html: wrapEmail(
        "New Support Ticket Received",
        `
        <table style="width:100%; border-collapse:collapse;">
          ${infoRow("Ticket Number", ticket.ticketNumber)}
          ${infoRow("Issue Type", ticket.issueType)}
          ${infoRow("Subject", ticket.subject)}
          ${infoRow("Description", ticket.description)}
          ${infoRow("Full Name", ticket.fullName)}
          ${infoRow("Email", ticket.email)}
          ${infoRow("Phone", ticket.phone)}
          ${infoRow("Student ID", ticket.studentId)}
          ${infoRow("Status", ticket.status)}
          ${infoRow("Priority", ticket.priority)}
          ${infoRow("Created Date", new Date(ticket.createdAt).toLocaleString("en-IN"))}
        </table>
        `
      ),
    });
  } catch (err) {
    console.error(`[supportTicket] admin notification email FAILED for ${ticket.ticketNumber}:`, err.message);
  }
};

// ── User confirmation email — sent to the ticket submitter ────────────────
const sendUserConfirmationEmail = async (ticket) => {
  if (!ticket.email) return;
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: ticket.email,
      subject: `Support Ticket Received - ${ticket.ticketNumber}`,
      html: wrapEmail(
        "We've received your support ticket",
        `
        <p>Hi ${escapeHtml(ticket.fullName)},</p>
        <p>Thank you for reaching out. Our support team has received your ticket and will get back to you shortly.</p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0;">
          ${infoRow("Ticket Number", ticket.ticketNumber)}
          ${infoRow("Issue Type", ticket.issueType)}
          ${infoRow("Subject", ticket.subject)}
          ${infoRow("Description", ticket.description)}
          ${infoRow("Current Status", ticket.status)}
        </table>
        <p>This is a confirmation from the DeepScode support team that your ticket is being tracked.</p>
        `
      ),
    });
  } catch (err) {
    console.error(`[supportTicket] user confirmation email FAILED for ${ticket.ticketNumber}:`, err.message);
  }
};

// ── Reply email — sent to the user whenever admin replies ─────────────────
const sendReplyEmail = async (ticket) => {
  if (!ticket.email) return;
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: ticket.email,
      subject: `Update on Support Ticket - ${ticket.ticketNumber}`,
      html: wrapEmail(
        "Update on Your Support Ticket",
        `
        <p>Hi ${escapeHtml(ticket.fullName)},</p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0;">
          ${infoRow("Ticket Number", ticket.ticketNumber)}
          ${infoRow("Subject", ticket.subject)}
          ${infoRow("Current Status", ticket.status)}
        </table>
        <p><strong>Admin Reply:</strong></p>
        <p style="background:#f1f2f4; padding:12px; border-radius:8px; white-space:pre-wrap;">${escapeHtml(ticket.adminReply)}</p>
        `
      ),
    });
  } catch (err) {
    console.error(`[supportTicket] reply email FAILED for ${ticket.ticketNumber}:`, err.message);
  }
};

module.exports = {
  generateTicketNumber,
  sendAdminTicketEmail,
  sendUserConfirmationEmail,
  sendReplyEmail,
};
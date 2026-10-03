// models/Notification.js
//
// In-app notification queue. Each document is a notification targeted at one user.
// The frontend polls GET /api/notifications (or uses a WebSocket) to show the bell icon.
//
// Email / SMS / WhatsApp are separate delivery channels — this model stores the
// in-app record regardless of which channels were also triggered.

const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "lead_assigned",        // Counsellor: new lead assigned to you
  "followup_due",         // Counsellor: follow-up is due today
  "demo_reminder",        // Counsellor: demo scheduled for today
  "student_approved",     // Student: your account has been approved
  "student_pending",      // Admin: new student registration pending approval
  "lead_converted",       // Admin: a lead was converted to a student
  "fee_reminder",         // Student: fee payment due
  "payment_received",     // Accountant: new payment recorded
    "support_ticket_created",   
  "support_ticket_assigned",  
  "support_ticket_reply",     
  "general",              // Catch-all
];

const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: `Type must be one of: ${NOTIFICATION_TYPES.join(", ")}`,
      },
      required: true,
    },

    // Short notification title (shown in the bell dropdown)
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    // Longer description (shown in the notification detail view)
    body: {
      type: String,
      trim: true,
      default: "",
    },

    // Deep-link: where the user should go when they click this notification
    // e.g. "/admin/leads/64abc123", "/counsellor/follow-ups"
    link: {
      type: String,
      trim: true,
      default: null,
    },

    // Related document for easy fetching
    relatedResource: {
      type: String,
      default: null, // e.g. "Inquiry", "User", "Fee"
    },

    relatedResourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast: unread count for bell badge
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// TTL: auto-delete notifications older than 90 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

module.exports = mongoose.model("Notification", notificationSchema);
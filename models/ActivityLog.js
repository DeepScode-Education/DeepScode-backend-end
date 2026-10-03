// models/ActivityLog.js
//
// System-wide audit trail. Appended to by the activityLogger middleware
// (middleware/activityLogger.middleware.js) and optionally by controllers
// for business-level events that don't fit the HTTP layer.
//
// DESIGN NOTES
// ─────────────────────────────────────────────────────────────────────────────
// • Append-only — never update or delete records.
// • Kept lean: only fields that are genuinely queried are indexed.
// • `resourceId` is intentionally untyped (String, not ObjectId) so it can
//   hold IDs from any collection without a union type hack.
// • TTL set to 1 year by default. Adjust or remove for compliance environments.

const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for unauthenticated requests
    },

    // Denormalised for display without populate
    userName: {
      type: String,
      trim: true,
      default: "Anonymous",
    },

    userRole: {
      type: String,
      default: null,
    },

    // What was done — verb in past tense, snake_case
    // Examples: "lead.status_changed", "student.approved", "course.published"
    action: {
      type: String,
      required: true,
      trim: true,
    },

    // Which collection the action acted on
    resource: {
      type: String,
      trim: true,
      default: null,
      // e.g. "Inquiry", "User", "Course", "Fee"
    },

    // The _id of the document that was acted on (stored as string for flexibility)
    resourceId: {
      type: String,
      default: null,
    },

    // Short summary shown in the admin activity feed
    // e.g. "Approved student 1234", "Changed lead status to converted"
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Flexible payload for before/after states, diff data, etc.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Network context
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      default: null,
    },

    // HTTP context (useful for debugging)
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", null],
      default: null,
    },

    endpoint: {
      type: String,
      trim: true,
      default: null,
    },

    statusCode: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    // Write concern: majority for audit integrity.
    // Only uncomment if your replica set supports it.
    // writeConcern: { w: "majority" },
  }
);

// Frequently queried: "show me all actions by this user"
activityLogSchema.index({ userId: 1, createdAt: -1 });

// "show me all actions on this lead"
activityLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });

// "show me all actions in the last 24 hours"
activityLogSchema.index({ createdAt: -1 });

// TTL: auto-delete logs older than 1 year
// Remove if permanent audit trail is required
activityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
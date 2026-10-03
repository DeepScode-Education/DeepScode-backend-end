// models/LeadTimeline.js
//
// Immutable audit log of every meaningful event on a lead.
// Records are created by helper functions in lead.controller.js —
// never edited or deleted (append-only).
//
// EVENT TYPES
// ──────────────────────────────────────────────────────────────────────────────
// lead_created        ← POST /api/inquiries
// lead_assigned       ← PATCH /api/leads/:id/assign
// status_changed      ← PATCH /api/leads/:id/status
// followup_added      ← POST  /api/leads/:id/followups
// followup_completed  ← PATCH /api/leads/:id/followups/:fid/complete
// demo_scheduled      ← PATCH /api/leads/:id/demo
// demo_completed      ← PATCH /api/leads/:id/demo  (demoCompleted: true)
// note_added          ← POST  /api/leads/:id/notes  (future)
// info_updated        ← PATCH /api/leads/:id/info
// converted           ← POST  /api/leads/:id/convert
// lost                ← POST  /api/leads/:id/lost
// priority_changed    ← PATCH /api/leads/:id/priority

const mongoose = require("mongoose");

const EVENT_TYPES = [
  "lead_created",
  "lead_assigned",
  "status_changed",
  "followup_added",
  "followup_completed",
  "demo_scheduled",
  "demo_completed",
  "note_added",
  "info_updated",
  "converted",
  "lost",
  "priority_changed",
  "document_added",
  "document_removed",
  "objections_updated",
];

const leadTimelineSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inquiry",
      required: true,
      index: true,
    },

    event: {
      type: String,
      enum: {
        values: EVENT_TYPES,
        message: `Event must be one of: ${EVENT_TYPES.join(", ")}`,
      },
      required: true,
    },

    // Human-readable summary shown in the timeline UI
    // e.g. "Status changed from 'new' to 'contacted'"
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Flexible payload — store before/after values, IDs, names etc.
    // Kept as Mixed so it can hold any shape without migration.
    // Examples:
    //   status_changed:   { from: "new", to: "contacted" }
    //   lead_assigned:    { from: "Alice", to: "Bob", fromId: ObjectId, toId: ObjectId }
    //   followup_added:   { followUpId: ObjectId, type: "call", nextDate: Date }
    //   converted:        { studentId: ObjectId, studentUserId: ObjectId }
    //   priority_changed: { from: "low", to: "high" }
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Who triggered the event — null for system-generated events
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Denormalised for display without a populate
    performedByName: {
      type: String,
      trim: true,
      default: null,
    },

    performedByRole: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt is the "event timestamp" shown in the UI
    // No updatedAt needed — timeline entries are immutable
  }
);

// Compound index for the most common query: all events for a lead, newest first
leadTimelineSchema.index({ leadId: 1, createdAt: -1 });

// TTL: auto-purge events older than 2 years to keep the collection lean
// Remove this line if you need permanent audit logs for compliance
// leadTimelineSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

module.exports = mongoose.model("LeadTimeline", leadTimelineSchema);
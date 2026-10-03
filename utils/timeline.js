// utils/timeline.js
//
// Shared helpers for appending records to LeadTimeline, LeadStatusHistory,
// and LeadAssignmentHistory. Import these in any controller that touches leads.
//
// All functions are fire-and-forget safe — they catch their own errors and
// log them without crashing the parent request.

const LeadTimeline          = require("../models/LeadTimeline");
const LeadStatusHistory     = require("../models/LeadStatusHistory");
const LeadAssignmentHistory = require("../models/LeadAssignmentHistory");

// ─── Core timeline append ──────────────────────────────────────────────────────
/**
 * appendTimeline(leadId, event, description, metadata, performer)
 *
 * @param {string|ObjectId} leadId
 * @param {string}          event       — must be a valid EVENT_TYPE
 * @param {string}          description — human-readable summary
 * @param {object}          [metadata]  — before/after data, IDs, etc.
 * @param {object}          [performer] — req.user (id, fullName, role) or null
 */
const appendTimeline = async (leadId, event, description, metadata = {}, performer = null) => {
  try {
    await LeadTimeline.create({
      leadId,
      event,
      description,
      metadata,
      performedBy:     performer?.id || performer?._id || null,
      performedByName: performer?.fullName || performer?.name || null,
      performedByRole: performer?.role || null,
    });
  } catch (err) {
    console.error("[timeline] append failed:", err.message, { leadId, event });
  }
};

// ─── Status change ─────────────────────────────────────────────────────────────
/**
 * logStatusChange(leadId, fromStatus, toStatus, performer, remarks)
 * Creates both a LeadStatusHistory record and a LeadTimeline event.
 */
const logStatusChange = async (leadId, fromStatus, toStatus, performer = null, remarks = "") => {
  try {
    await LeadStatusHistory.create({
      leadId,
      fromStatus,
      toStatus,
      changedBy:     performer?.id || performer?._id || null,
      changedByName: performer?.fullName || performer?.name || null,
      remarks,
    });
  } catch (err) {
    console.error("[timeline] status history failed:", err.message);
  }

  await appendTimeline(
    leadId,
    "status_changed",
    `Status changed from "${fromStatus}" to "${toStatus}"${remarks ? ` — ${remarks}` : ""}`,
    { from: fromStatus, to: toStatus, remarks },
    performer
  );
};

// ─── Assignment change ─────────────────────────────────────────────────────────
/**
 * logAssignment(leadId, from, to, assignedBy, reason)
 * @param {object} from — { id, name } of previous counsellor (or null)
 * @param {object} to   — { id, name } of new counsellor (or null)
 */
const logAssignment = async (leadId, from, to, assignedBy = null, reason = "") => {
  try {
    await LeadAssignmentHistory.create({
      leadId,
      fromCounsellor:     from?.id || null,
      fromCounsellorName: from?.name || null,
      toCounsellor:       to?.id || null,
      toCounsellorName:   to?.name || null,
      assignedBy:         assignedBy?.id || assignedBy?._id || null,
      assignedByName:     assignedBy?.fullName || assignedBy?.name || null,
      reason,
    });
  } catch (err) {
    console.error("[timeline] assignment history failed:", err.message);
  }

  const fromLabel = from?.name || "Unassigned";
  const toLabel   = to?.name   || "Unassigned";

  await appendTimeline(
    leadId,
    "lead_assigned",
    `Lead reassigned from ${fromLabel} to ${toLabel}${reason ? ` — ${reason}` : ""}`,
    { from, to, reason },
    assignedBy
  );
};

module.exports = { appendTimeline, logStatusChange, logAssignment };
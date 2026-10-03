// utils/notify.js
//
// Fire-and-forget notification creator.
// Call this from any controller that should trigger an in-app notification.
// All calls are try/catch wrapped — notification failures must never crash the
// parent request.
//
// USAGE
// ─────
// const { notify } = require("../utils/notify");
//
// await notify({
//   userId:      counsellorUser._id,
//   type:        "lead_assigned",
//   title:       "New lead assigned to you",
//   body:        `${lead.fullName} (${lead.course}) has been assigned to you.`,
//   link:        `/counsellor/leads/${lead._id}`,
//   relatedResource:   "Inquiry",
//   relatedResourceId: lead._id,
// });

const Notification = require("../models/Notification");

/**
 * notify(options)
 *
 * @param {object} options
 * @param {ObjectId|string} options.userId              — recipient
 * @param {string}          options.type                — NOTIFICATION_TYPE
 * @param {string}          options.title               — short text for bell
 * @param {string}          [options.body]              — longer description
 * @param {string}          [options.link]              — frontend deep-link
 * @param {string}          [options.relatedResource]   — collection name
 * @param {ObjectId|string} [options.relatedResourceId] — document _id
 */
const notify = async (options) => {
  try {
    if (!options?.userId || !options?.type || !options?.title) {
      console.warn("[notify] missing required fields — skipped");
      return;
    }
    await Notification.create(options);
  } catch (err) {
    console.error("[notify] failed:", err.message);
  }
};

/**
 * notifyMany(userIds, options)
 * Send the same notification to multiple users (e.g. all admins).
 */
const notifyMany = async (userIds = [], baseOptions = {}) => {
  if (!userIds.length) return;
  try {
    const docs = userIds.map((userId) => ({ ...baseOptions, userId }));
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("[notifyMany] failed:", err.message);
  }
};

module.exports = { notify, notifyMany };
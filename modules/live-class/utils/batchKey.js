// modules/live-class/utils/batchKey.js
//
// Same pattern as mentorPortal.controller.js — encodes (course, days, time)
// into one opaque ID so we never expose raw ObjectIds/schedule combos.

const buildBatchKey = (courseId, days, time) => `${courseId}::${days}::${time}`;

const encodeBatchId = (key) => Buffer.from(key, "utf8").toString("base64url");

const decodeBatchId = (id) => {
  try {
    return Buffer.from(id, "base64url").toString("utf8");
  } catch (_) {
    return null;
  }
};

module.exports = { buildBatchKey, encodeBatchId, decodeBatchId };
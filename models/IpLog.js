const mongoose = require("mongoose");

const ipLogSchema = new mongoose.Schema(
  {
    // Encrypted IP address
    ip: {
      type: String,
      required: true,
    },

    page: {
      type: String,
      default: "/",
    },

    userAgent: {
      type: String,
      default: null,
    },

    device: {
      type: String,
      default: null,
    },

    os: {
      type: String,
      default: null,
    },

    browser: {
      type: String,
      default: null,
    },

    referrer: {
      type: String,
      default: null,
    },

    // ── NEW: first-party visitor identity ────────────────────────────────────
    // Set via an httpOnly cookie by middleware/visitorTracker.middleware.js.
    // Lets us distinguish individual visitors even when they share an IP
    // (office/college wifi, NAT), and lets a LATER request (once geolocation
    // permission is granted) attach location data to the right visit record.
    visitorId: {
      type: String,
      default: null,
      index: true,
    },

    // ── User linkage — resolved SERVER-SIDE from a verified JWT only.
    // Never taken from the frontend request body/query. `user` is the
    // authoritative reference; userEmail/userName are denormalised
    // snapshots so logs can be browsed without an extra populate(). ──
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userEmail: {
      type: String,
      default: null,
    },
    userName: {
      type: String,
      default: null,
    },

    // ── NEW: optional geolocation, populated only if the browser granted
    // permission — see controllers/visitorLocation.controller.js. ──
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      collectedAt: { type: Date, default: null },
    },

    visitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Latest visitor top par lane ke liye index
ipLogSchema.index({
  visitedAt: -1,
});

// NEW: fast lookup of "this visitor's most recent visits" — used both by
// the dedup check and by the location-update endpoint.
ipLogSchema.index({ visitorId: 1, visitedAt: -1 });

module.exports = mongoose.model(
  "IpLog",
  ipLogSchema
);
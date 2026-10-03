// // modules/live-class/models/LiveClass.js

// const mongoose = require("mongoose");

// const STATUSES = ["scheduled", "live", "ended", "cancelled"];

// const batchSchema = new mongoose.Schema(
//   {
//     days: { type: String, required: true },
//     time: { type: String, required: true },
//   },
//   { _id: false }
// );

// const liveClassSchema = new mongoose.Schema(
//   {
//     course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
//     mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
//     batch: { type: batchSchema, required: true },

//     title: { type: String, trim: true, default: "Live Class" },

//     provider: { type: String, default: "zoom" },
//     providerMeetingId: { type: String, default: null },
//     providerMeetingPassword: { type: String, default: null, select: false },

//     status: { type: String, enum: STATUSES, default: "scheduled", index: true },

//     scheduledAt: { type: Date, default: null },
//     startedAt: { type: Date, default: null },
//     endedAt: { type: Date, default: null },

//     // Auto-end support (Phase 7)
//     lastHostHeartbeat: { type: Date, default: null },
//     autoEndTimeoutMinutes: { type: Number, default: 10 },

//         providerMeetingId: { type: String, default: null },
//     providerMeetingPassword: { type: String, default: null, select: false },
//     // NEW — the Zoom user ID the meeting was created under (from Zoom's
//     // create-meeting response, `host_id`). Used to request the correct
//     // ZAK later instead of always assuming "me".
//     hostZoomUserId: { type: String, default: null },

//     createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   },

//   { timestamps: true }
// );

// liveClassSchema.index({ mentor: 1, status: 1 });
// // liveClassSchema.index({ course: 1, "batch.days": 1, "batch.time": 1, status: 1 });
// liveClassSchema.index(
//   { course: 1, "batch.days": 1, "batch.time": 1, status: 1 },
//   { unique: true, partialFilterExpression: { status: "live" } }
// );

// module.exports = mongoose.model("LiveClass", liveClassSchema);
// module.exports.STATUSES = STATUSES;

// modules/live-class/models/LiveClass.js

const mongoose = require("mongoose");

const STATUSES = ["scheduled", "live", "ended", "cancelled"];

const batchSchema = new mongoose.Schema(
  {
    days: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const liveClassSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },

    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    batch: {
      type: batchSchema,
      required: true,
    },

    title: {
      type: String,
      trim: true,
      default: "Live Class",
    },

    // LiveKit
    provider: {
      type: String,
      default: "livekit",
      enum: ["livekit"],
    },

    livekitRoomName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: STATUSES,
      default: "scheduled",
      index: true,
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    // Auto-end support
    lastHostHeartbeat: {
      type: Date,
      default: null,
    },

    autoEndTimeoutMinutes: {
      type: Number,
      default: 10,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

liveClassSchema.index({
  mentor: 1,
  status: 1,
});

liveClassSchema.index(
  {
    course: 1,
    "batch.days": 1,
    "batch.time": 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "live",
    },
  },
);

module.exports = mongoose.model("LiveClass", liveClassSchema);
module.exports.STATUSES = STATUSES;

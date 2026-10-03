// routes/adminRecordedCourse.routes.js
//
// Admin-only recorded-course video management.
// Mounted at /api/admin in index.js.

const express = require("express");
const router = express.Router();

const { auth, isAdmin } = require("../middleware/auth.middleware");
const { videoUpload, handleUploadError } = require("../middleware/videoUpload.middleware");

const {
  getCourseBatches,
  getBatchVideos,
  uploadBatchVideo,
  streamVideo,
  deleteVideo,
} = require("../controllers/adminRecordedCourse.controller");

// Every route below requires a valid token + admin/super_admin role.
router.use(auth, isAdmin);

// ── Batches ─────────────────────────────────────────────────────────────────
router.get("/recorded-courses/:courseId/batches", getCourseBatches);
router.get("/recorded-courses/:courseId/batches/:batchId/videos", getBatchVideos);
router.post(
  "/recorded-courses/:courseId/batches/:batchId/videos",
  videoUpload,
  handleUploadError,
  uploadBatchVideo
);

// ── Individual videos ───────────────────────────────────────────────────────
router.get("/recorded-videos/:videoId/stream", streamVideo);
router.delete("/recorded-videos/:videoId", deleteVideo);

module.exports = router;
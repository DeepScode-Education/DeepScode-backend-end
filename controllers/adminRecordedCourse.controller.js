// controllers/adminRecordedCourse.controller.js
//
// Admin-only recorded-course video management, built entirely on top of the
// EXISTING virtual batch system (StudentAssignment grouped by
// course + batch.days + batch.time — see controllers/mentorPortal.controller.js)
// and the EXISTING Video model + Google Drive integration
// (see controllers/mentorVideo.controller.js / config/googleDrive.js).
//
// No new Batch collection is introduced. No new Video model is introduced.
// No new Google Drive helpers are introduced — everything below reuses the
// exact same batch-key encoding, Video schema, and Drive upload/stream/delete
// functions the mentor flow already depends on.

const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const { ValidationError, NotFoundError } = require("../utils/errors/errorTypes");

const StudentAssignment = require("../models/Studentassignment");
const Course = require("../models/Course");
const Video = require("../models/Video");
const googleDrive = require("../config/googleDrive");

// Reuse — never re-implement — the existing batch identification helpers.
const {
  encodeBatchId,
  decodeBatchId,
  buildBatchKey,
  groupIntoBatches,
} = require("./mentorPortal.controller");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

// ── Admin-scoped assignment lookup ─────────────────────────────────────────────
const getCourseAssignmentDocs = (courseId) =>
  StudentAssignment.find({ course: courseId, status: "active" })
    .populate("student", "fullName email studentId")
    .populate("course", "title category")
    .populate("mentor", "fullName email");

// ── Resolve + validate a batch strictly against the given course ──────────────
const resolveCourseBatch = async (courseId, encodedBatchId) => {
  const decodedKey = decodeBatchId(encodedBatchId);
  if (!decodedKey) {
    throw new ValidationError("Invalid batch ID.");
  }

  const parts = decodedKey.split("::");
  if (parts.length !== 3) {
    throw new ValidationError("Invalid batch ID.");
  }

  const [batchCourseId, days, time] = parts;

  if (!batchCourseId || String(batchCourseId) !== String(courseId)) {
    throw new ValidationError("This batch does not belong to the specified course.");
  }

  const assignments = await getCourseAssignmentDocs(courseId);
  const batches = groupIntoBatches(assignments);
  const batch = batches.find((b) => b.id === encodedBatchId);

  if (!batch) {
    throw new NotFoundError("Batch not found for this course.");
  }

  const batchKey = buildBatchKey(courseId, days, time);

  return { batch, batchKey, days, time, assignments };
};

const toVideoSummary = (video) => ({
  id: video._id,
  title: video.title,
  description: video.description,
  duration: video.duration,
  fileName: video.fileName,
  fileSize: video.fileSize,
  createdAt: video.createdAt,
  uploadedBy: video.uploadedBy?.fullName || null,
  streamUrl: `/api/admin/recorded-videos/${video._id}/stream`,
});

// ── GET /api/admin/recorded-courses/:courseId/batches ──────────────────────────
const getCourseBatches = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  if (!isValidId(courseId)) {
    throw new ValidationError("Invalid course ID.", { field: "courseId", value: courseId });
  }

  const course = await Course.findById(courseId).select("_id title");
  if (!course) {
    throw new NotFoundError(`No course was found with ID "${courseId}".`);
  }

  const assignments = await getCourseAssignmentDocs(courseId);
  const batches = groupIntoBatches(assignments);

  const data = await Promise.all(
    batches.map(async (batch) => {
      const batchAssignments = assignments.filter((a) =>
        batch.studentAssignmentIds.some((bid) => String(bid) === String(a._id))
      );

      const mentorAssignment = batchAssignments.find((a) => a.mentor);
      const mentor = mentorAssignment
        ? {
            _id: mentorAssignment.mentor._id,
            fullName: mentorAssignment.mentor.fullName,
            email: mentorAssignment.mentor.email,
          }
        : null;

      const batchKey = buildBatchKey(courseId, batch.batchDays, batch.batchTime);
      const videoCount = await Video.countDocuments({ course: courseId, batchKey });

      return {
        batchId: batch.id,
        courseId: String(courseId),
        days: batch.batchDays,
        time: batch.batchTime,
        isUnscheduled: batch.isUnscheduled,
        mentor,
        studentCount: batch.totalStudents,
        videoCount,
      };
    })
  );

  data.sort((a, b) => (a.days || "").localeCompare(b.days || "") || (a.time || "").localeCompare(b.time || ""));

  return send(res, 200, true, "Batches fetched", data, { course: { _id: course._id, title: course.title } });
});

// ── GET /api/admin/recorded-courses/:courseId/batches/:batchId/videos ─────────
const getBatchVideos = catchAsync(async (req, res) => {
  const { courseId, batchId } = req.params;
  if (!isValidId(courseId)) {
    throw new ValidationError("Invalid course ID.", { field: "courseId", value: courseId });
  }

  const course = await Course.findById(courseId).select("_id title");
  if (!course) {
    throw new NotFoundError(`No course was found with ID "${courseId}".`);
  }

  const { batchKey, days, time } = await resolveCourseBatch(courseId, batchId);

  const videos = await Video.find({ course: courseId, batchKey })
    .populate("uploadedBy", "fullName role")
    .sort({ createdAt: -1 });

  return send(res, 200, true, "Videos fetched", videos.map(toVideoSummary), {
    batch: { batchId, courseId: String(courseId), days, time },
  });
});

// ── POST /api/admin/recorded-courses/:courseId/batches/:batchId/videos ────────
const uploadBatchVideo = catchAsync(async (req, res) => {
  const { courseId, batchId } = req.params;
  if (!isValidId(courseId)) {
    throw new ValidationError("Invalid course ID.", { field: "courseId", value: courseId });
  }

  const course = await Course.findById(courseId).select("_id");
  if (!course) {
    throw new NotFoundError(`No course was found with ID "${courseId}".`);
  }

  const { batchKey, days, time } = await resolveCourseBatch(courseId, batchId);

  const { title, description = "" } = req.body;
  if (!title || !title.trim()) {
    throw new ValidationError("Title is required.");
  }
  if (!req.file) {
    throw new ValidationError("A video file is required.");
  }

  const uploadResult = await googleDrive.uploadVideoToDrive({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    fileName: req.file.originalname,
  });

  let video;
  try {
    video = await Video.create({
      title: title.trim(),
      description: description?.trim() || "",
      course: courseId,
      batch: { days, time },
      batchKey,
      driveFileId: uploadResult.driveFileId,
      fileName: uploadResult.fileName,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      uploadedBy: req.user.id,
    });
  } catch (err) {
    await googleDrive.deleteFile(uploadResult.driveFileId).catch(() => {});
    throw err;
  }

  const populated = await Video.findById(video._id).populate("uploadedBy", "fullName role");

  return send(res, 201, true, "Video uploaded successfully", toVideoSummary(populated));
});

// ── GET /api/admin/recorded-videos/:videoId/stream ─────────────────────────────
const streamVideo = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidId(videoId)) {
    throw new ValidationError("Invalid video ID.", { field: "videoId", value: videoId });
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new NotFoundError("Video not found.");
  }

  const rangeHeader = req.headers.range;
  const { stream, headers, status } = await googleDrive.getFileStream(video.driveFileId, rangeHeader);

  const isPartial = Boolean(rangeHeader) && status === 206;
  res.status(isPartial ? 206 : 200);
  res.setHeader("Content-Type", headers["content-type"] || video.mimeType);
  res.setHeader("Accept-Ranges", "bytes");
  if (headers["content-length"]) res.setHeader("Content-Length", headers["content-length"]);
  if (headers["content-range"]) res.setHeader("Content-Range", headers["content-range"]);

  stream.on("error", () => {
    if (!res.headersSent) res.status(502);
    res.end();
  });

  stream.pipe(res);
});

// ── DELETE /api/admin/recorded-videos/:videoId ─────────────────────────────────
const deleteVideo = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidId(videoId)) {
    throw new ValidationError("Invalid video ID.", { field: "videoId", value: videoId });
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new NotFoundError("Video not found.");
  }

  await googleDrive.deleteFile(video.driveFileId);
  await Video.findByIdAndDelete(videoId);

  return send(res, 200, true, "Video deleted successfully");
});

module.exports = {
  getCourseBatches,
  getBatchVideos,
  uploadBatchVideo,
  streamVideo,
  deleteVideo,
};
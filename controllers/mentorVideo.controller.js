// controllers/mentorVideo.controller.js
//
// Mentor-facing video management, layered on top of the EXISTING virtual
// batch system in mentorPortal.controller.js (StudentAssignment grouped by
// course + batch.days + batch.time, identified by an opaque base64url
// batch key). No new Batch model is introduced.
//
// Every route re-verifies mentor ownership server-side — the frontend's
// batchId / videoId are only ever used as lookup keys, never trusted for
// authorization.

const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const { ValidationError, NotFoundError, AuthorizationError } = require("../utils/errors/errorTypes");
const StudentAssignment = require("../models/Studentassignment");
const Video = require("../models/Video");
const googleDrive = require("../config/googleDrive");
const { decodeBatchId, buildBatchKey } = require("./mentorPortal.controller");

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

// Resolves the opaque :id batch param into { courseId, days, time } and
// verifies the authenticated mentor actually has an active assignment for
// that exact batch.
const resolveMentorBatch = async (mentorId, encodedBatchId) => {
  const decodedKey = decodeBatchId(encodedBatchId);
  if (!decodedKey) throw new ValidationError("Invalid batch ID.");

  const [courseId, days, time] = decodedKey.split("::");
  if (!courseId || !days || !time || !mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ValidationError("Invalid batch ID.");
  }

  const assignment = await StudentAssignment.findOne({
    mentor: mentorId,
    course: courseId,
    status: "active",
    "batch.days": days,
    "batch.time": time,
  }).select("_id");

  if (!assignment) {
    throw new AuthorizationError("You do not have access to this batch.");
  }

  return { courseId, days, time, batchKey: buildBatchKey(courseId, days, time) };
};

// Re-derives batch ownership directly from the video document — used by
// every video-level route (get/delete/stream) so access is never inferred
// from anything the client supplied.
const verifyMentorOwnsVideo = async (mentorId, video) => {
  const assignment = await StudentAssignment.findOne({
    mentor: mentorId,
    course: video.course,
    status: "active",
    "batch.days": video.batch.days,
    "batch.time": video.batch.time,
  }).select("_id");

  if (!assignment) {
    throw new AuthorizationError("You do not have access to this video.");
  }
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
  streamUrl: `/api/mentor/videos/${video._id}/stream`,
});

// GET /api/mentor/batches/:id/videos
const getBatchVideos = catchAsync(async (req, res) => {
  const { batchKey } = await resolveMentorBatch(req.user.id, req.params.id);

  const videos = await Video.find({ batchKey })
    .populate("uploadedBy", "fullName")
    .sort({ createdAt: -1 });

  return send(res, 200, true, "Videos fetched", videos.map(toVideoSummary));
});

// POST /api/mentor/batches/:id/videos
const uploadBatchVideo = catchAsync(async (req, res) => {
  const { courseId, days, time, batchKey } = await resolveMentorBatch(req.user.id, req.params.id);

  const { title, description = "" } = req.body;
  if (!title || !title.trim()) throw new ValidationError("Title is required.");
  if (!req.file) throw new ValidationError("A video file is required.");

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
    // Mongo write failed after a successful Drive upload — clean up the
    // now-orphaned Drive file rather than leaving it dangling forever.
    await googleDrive.deleteFile(uploadResult.driveFileId).catch(() => {});
    throw err;
  }

  const populated = await Video.findById(video._id).populate("uploadedBy", "fullName");
  return send(res, 201, true, "Video uploaded successfully", toVideoSummary(populated));
});

// GET /api/mentor/videos/:videoId
const getVideoById = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ValidationError("Invalid video ID.");

  const video = await Video.findById(videoId).populate("uploadedBy", "fullName");
  if (!video) throw new NotFoundError("Video not found.");

  await verifyMentorOwnsVideo(req.user.id, video);

  return send(res, 200, true, "Video fetched", toVideoSummary(video));
});

// DELETE /api/mentor/videos/:videoId
const deleteVideo = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ValidationError("Invalid video ID.");

  const video = await Video.findById(videoId);
  if (!video) throw new NotFoundError("Video not found.");

  await verifyMentorOwnsVideo(req.user.id, video);

  // Drive deletion must succeed first — never remove the DB record if the
  // actual file couldn't be deleted, to avoid orphaning storage silently.
  await googleDrive.deleteFile(video.driveFileId);
  await Video.findByIdAndDelete(videoId);

  return send(res, 200, true, "Video deleted successfully");
});

// GET /api/mentor/videos/:videoId/stream
const streamVideo = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ValidationError("Invalid video ID.");

  const video = await Video.findById(videoId);
  if (!video) throw new NotFoundError("Video not found.");

  await verifyMentorOwnsVideo(req.user.id, video);

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

module.exports = {
  getBatchVideos,
  uploadBatchVideo,
  getVideoById,
  deleteVideo,
  streamVideo,
};
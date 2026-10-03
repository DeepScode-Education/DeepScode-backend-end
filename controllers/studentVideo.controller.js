const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const { ValidationError, NotFoundError, AuthorizationError } = require("../utils/errors/errorTypes");
const StudentAssignment = require("../models/Studentassignment");
const Video = require("../models/Video");
const googleDrive = require("../config/googleDrive");
const { buildBatchKey } = require("./mentorPortal.controller");

const getStudentBatchKey = async (studentId) => {
  const assignment = await StudentAssignment.findOne({ student: studentId, status: "active" });
  if (!assignment || !assignment.course || !assignment.batch?.days || !assignment.batch?.time) return null;
  return buildBatchKey(assignment.course, assignment.batch.days, assignment.batch.time);
};

const verifyStudentOwnsVideo = async (studentId, video) => {
  const batchKey = await getStudentBatchKey(studentId);
  if (!batchKey || batchKey !== video.batchKey) {
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
  streamUrl: `/api/student/videos/${video._id}/stream`,
});

// GET /api/student/videos
const getMyVideos = catchAsync(async (req, res) => {
  const batchKey = await getStudentBatchKey(req.user.id);
  if (!batchKey) {
    return res.status(200).json({ success: true, message: "No batch assigned yet", data: [] });
  }
  const videos = await Video.find({ batchKey }).populate("uploadedBy", "fullName").sort({ createdAt: -1 });
  return res.status(200).json({ success: true, message: "Videos fetched", data: videos.map(toVideoSummary) });
});

// GET /api/student/videos/:videoId
const getVideoById = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ValidationError("Invalid video ID.");
  const video = await Video.findById(videoId).populate("uploadedBy", "fullName");
  if (!video) throw new NotFoundError("Video not found.");
  await verifyStudentOwnsVideo(req.user.id, video);
  return res.status(200).json({ success: true, message: "Video fetched", data: toVideoSummary(video) });
});

// GET /api/student/videos/:videoId/stream
const streamVideo = catchAsync(async (req, res) => {
  const { videoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ValidationError("Invalid video ID.");
  const video = await Video.findById(videoId);
  if (!video) throw new NotFoundError("Video not found.");
  await verifyStudentOwnsVideo(req.user.id, video);

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

module.exports = { getMyVideos, getVideoById, streamVideo };
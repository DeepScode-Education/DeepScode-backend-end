// controllers/assignmentSubmission.controller.js
const mongoose = require("mongoose");
const Assignment = require("../models/AssignmentSubmission");
const StudentAssignment = require("../models/Studentassignment");
const User = require("../models/User");
const cloudinary = require("../config/Cloudinary");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const uploadBufferToCloudinary = (buffer, folder, resourceType) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });

const resolveResourceType = (mimetype) => {
  if (mimetype.startsWith("image/")) {
    return "image";
  }
  return "raw";
};

const resolveFileType = (mimetype) => {
  if (mimetype.startsWith("image/")) {
    return "image";
  }
  if (mimetype === "application/pdf") {
    return "pdf";
  }
  return "raw";
};

const uploadFiles = async (files = []) => {
  const uploaded = [];
  for (const file of files) {
    const resourceType = resolveResourceType(file.mimetype);
    const result = await uploadBufferToCloudinary(
      file.buffer,
      "deepScode/assignments",
      resourceType
    );
    uploaded.push({
      name: file.originalname,
      url: result.secure_url,
      publicId: result.public_id,
      fileType: resolveFileType(file.mimetype),
      size: file.size,
    });
  }
  return uploaded;
};

const getMentorStudentIds = async (mentorId) => {
  const assignments = await StudentAssignment.find({ mentor: mentorId }).select("student");
  return assignments.map((a) => a.student);
};

const buildScopeFilter = async (req) => {
  if (req.user.role === "student") {
    return { student: req.user.id };
  }
  if (req.user.role === "mentor") {
    const studentIds = await getMentorStudentIds(req.user.id);
    return { student: { $in: studentIds } };
  }
  return {};
};

const findFirstImageUrl = (uploadedFiles) => {
  const imageFile = uploadedFiles.find((f) => f.fileType === "image");
  if (imageFile) {
    return imageFile.url;
  }
  return "";
};

const createAssignment = async (req, res) => {
  try {
    const { title, description, category, figmaLink, githubLink, liveLink, driveLink, notes } = req.body;

    if (!title || !title.trim()) {
      return send(res, 400, false, "Title is required");
    }
    if (!description || !description.trim()) {
      return send(res, 400, false, "Description is required");
    }

    const uploadedFiles = await uploadFiles(req.files || []);
    const thumbnailUrl = findFirstImageUrl(uploadedFiles);

    const assignment = await Assignment.create({
      student: req.user.id,
      title: title.trim(),
      description: description.trim(),
      category: category || "",
      thumbnail: thumbnailUrl,
      files: uploadedFiles,
      figmaLink: figmaLink || "",
      githubLink: githubLink || "",
      liveLink: liveLink || "",
      driveLink: driveLink || "",
      notes: notes || "",
      status: "Submitted",
    });

    return send(res, 201, true, "Assignment submitted successfully", assignment);
  } catch (error) {
    console.error("createAssignment error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ student: req.user.id }).sort({ createdAt: -1 });
    return send(res, 200, true, "Assignments fetched", assignments);
  } catch (error) {
    console.error("getMyAssignments error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getAllAssignments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "", search = "", studentId = "" } = req.query;

    const scopeFilter = await buildScopeFilter(req);
    const filter = { ...scopeFilter };

    if (status) {
      filter.status = status;
    }
    if (studentId && isValidId(studentId)) {
      filter.student = studentId;
    }
    if (search && search.trim()) {
      filter.title = { $regex: search.trim(), $options: "i" };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await Assignment.countDocuments(filter);
    const assignments = await Assignment.find(filter)
      .populate("student", "fullName email studentId")
      .populate("reviewedBy", "fullName role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return send(res, 200, true, "Assignments fetched", assignments, {
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAllAssignments error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return send(res, 400, false, "Invalid assignment ID");
    }

    const assignment = await Assignment.findById(id)
      .populate("student", "fullName email studentId")
      .populate("reviewedBy", "fullName role");

    if (!assignment) {
      return send(res, 404, false, "Assignment not found");
    }

    if (req.user.role === "student") {
      if (String(assignment.student._id) !== String(req.user.id)) {
        return send(res, 403, false, "You cannot view this assignment");
      }
    } else if (req.user.role === "mentor") {
      const studentIds = await getMentorStudentIds(req.user.id);
      const allowed = studentIds.some((sid) => String(sid) === String(assignment.student._id));
      if (!allowed) {
        return send(res, 403, false, "This student is not assigned to you");
      }
    }

    return send(res, 200, true, "Assignment fetched", assignment);
  } catch (error) {
    console.error("getAssignmentById error:", error);
    return send(res, 500, false, "Server error");
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return send(res, 400, false, "Invalid assignment ID");
    }

    const assignment = await Assignment.findOne({ _id: id, student: req.user.id });
    if (!assignment) {
      return send(res, 404, false, "Assignment not found");
    }

    if (assignment.status !== "Submitted") {
      return send(res, 400, false, "This assignment is already under review and cannot be edited");
    }

    const { title, description, category, figmaLink, githubLink, liveLink, driveLink, notes } = req.body;

    if (title !== undefined) {
      assignment.title = title.trim();
    }
    if (description !== undefined) {
      assignment.description = description.trim();
    }
    if (category !== undefined) {
      assignment.category = category;
    }
    if (figmaLink !== undefined) {
      assignment.figmaLink = figmaLink;
    }
    if (githubLink !== undefined) {
      assignment.githubLink = githubLink;
    }
    if (liveLink !== undefined) {
      assignment.liveLink = liveLink;
    }
    if (driveLink !== undefined) {
      assignment.driveLink = driveLink;
    }
    if (notes !== undefined) {
      assignment.notes = notes;
    }

    if (req.files && req.files.length) {
      const uploadedFiles = await uploadFiles(req.files);
      assignment.files.push(...uploadedFiles);
      if (!assignment.thumbnail) {
        const newThumbnailUrl = findFirstImageUrl(uploadedFiles);
        if (newThumbnailUrl) {
          assignment.thumbnail = newThumbnailUrl;
        }
      }
    }

    await assignment.save();
    return send(res, 200, true, "Assignment updated successfully", assignment);
  } catch (error) {
    console.error("updateAssignment error:", error);
    return send(res, 500, false, "Server error");
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return send(res, 400, false, "Invalid assignment ID");
    }

    const filter = { _id: id };
    if (req.user.role === "student") {
      filter.student = req.user.id;
    }

    const assignment = await Assignment.findOne(filter);
    if (!assignment) {
      return send(res, 404, false, "Assignment not found");
    }

    for (const file of assignment.files) {
      const resourceType = file.fileType === "image" ? "image" : "raw";
      cloudinary.uploader.destroy(file.publicId, { resource_type: resourceType }).catch(() => {});
    }

    await Assignment.findByIdAndDelete(id);
    return send(res, 200, true, "Assignment deleted successfully");
  } catch (error) {
    console.error("deleteAssignment error:", error);
    return send(res, 500, false, "Server error");
  }
};

const reviewAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return send(res, 400, false, "Invalid assignment ID");
    }

    const { status, grade, feedback } = req.body;

    const VALID_STATUSES = ["Under Review", "Approved", "Rejected"];
    if (status && !VALID_STATUSES.includes(status)) {
      return send(res, 400, false, "Status must be one of: " + VALID_STATUSES.join(", "));
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return send(res, 404, false, "Assignment not found");
    }

    if (req.user.role === "mentor") {
      const studentIds = await getMentorStudentIds(req.user.id);
      const allowed = studentIds.some((sid) => String(sid) === String(assignment.student));
      if (!allowed) {
        return send(res, 403, false, "This student is not assigned to you");
      }
    }

    if (status !== undefined) {
      assignment.status = status;
    }
    if (grade !== undefined) {
      assignment.grade = grade;
    }
    if (feedback !== undefined) {
      assignment.feedback = feedback;
    }
    assignment.reviewedBy = req.user.id;
    assignment.reviewedAt = new Date();

    await assignment.save();

    const populated = await Assignment.findById(id)
      .populate("student", "fullName email studentId")
      .populate("reviewedBy", "fullName role");

    return send(res, 200, true, "Assignment reviewed successfully", populated);
  } catch (error) {
    console.error("reviewAssignment error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  createAssignment,
  getMyAssignments,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  reviewAssignment,
};
// controllers/adminStudentDocument.controller.js
const mongoose = require("mongoose");
const StudentDocument = require("../models/StudentDocument");
const { DOCUMENT_TYPES } = require("../models/StudentDocument");
const User = require("../models/User");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

// ── GET /api/admin/students/:studentId/documents — full 6-slot view ──
const getStudentDocuments = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    const student = await User.findOne({ _id: studentId, role: "student" }).select("_id");
    if (!student) return send(res, 404, false, "Student not found");

    const docs = await StudentDocument.find({ student: studentId }).populate(
      "reviewedBy",
      "fullName"
    );
    const docMap = new Map(docs.map((d) => [d.type, d]));

    const merged = DOCUMENT_TYPES.map((type) => {
      const existing = docMap.get(type);
      if (!existing) {
        return {
          id: type,
          docId: null,
          status: "empty",
          fileType: null,
          fileSize: null,
          uploadedAt: null,
          fileUrl: null,
          note: null,
          reviewedBy: null,
          reviewedAt: null,
        };
      }
      return {
        id: type,
        docId: existing._id,
        status: existing.status,
        fileType: existing.fileType,
        fileSize: existing.fileSize,
        uploadedAt: existing.updatedAt,
        fileUrl: existing.fileUrl,
        note: existing.note || null,
        reviewedBy: existing.reviewedBy?.fullName || null,
        reviewedAt: existing.reviewedAt,
      };
    });

    return send(res, 200, true, "Student documents fetched", merged);
  } catch (error) {
    console.error("getStudentDocuments error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/admin/students/:studentId/documents/:type/verify ──
const verifyDocument = async (req, res) => {
  try {
    const { studentId, type } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");
    if (!DOCUMENT_TYPES.includes(type)) return send(res, 400, false, "Invalid document type");

    const doc = await StudentDocument.findOneAndUpdate(
      { student: studentId, type },
      {
        status: "verified",
        note: "",
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!doc) return send(res, 404, false, "Document not found — student hasn't uploaded this yet");

    return send(res, 200, true, "Document marked as verified", doc);
  } catch (error) {
    console.error("verifyDocument error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── PATCH /api/admin/students/:studentId/documents/:type/request-action ──
// body: { note: string }  — reason the student needs to re-upload
const requestActionOnDocument = async (req, res) => {
  try {
    const { studentId, type } = req.params;
    const { note } = req.body;

    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");
    if (!DOCUMENT_TYPES.includes(type)) return send(res, 400, false, "Invalid document type");
    if (!note || !note.trim()) return send(res, 400, false, "A note explaining the required action is required");

    const doc = await StudentDocument.findOneAndUpdate(
      { student: studentId, type },
      {
        status: "action_required",
        note: note.trim(),
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!doc) return send(res, 404, false, "Document not found — student hasn't uploaded this yet");

    return send(res, 200, true, "Action requested from student", doc);
  } catch (error) {
    console.error("requestActionOnDocument error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = { getStudentDocuments, verifyDocument, requestActionOnDocument };
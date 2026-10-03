const mongoose = require("mongoose");
const StaffDocument = require("../models/StaffDocument");
const User = require("../models/User");

const send = (res, status, success, message, data = undefined) => {
  const body = { success, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const DOCUMENT_TYPES = new Set([
  "aadhaar", "pan", "resume", "offer_letter", "joining_letter",
  "experience_letter", "salary_slip", "bank_proof", "other",
]);

const getStaffDocuments = async (req, res) => {
  try {
    const staffId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return send(res, 400, false, "Invalid staff ID");
    }

    const staff = await User.findOne({ _id: staffId, role: { $ne: "student" } }).select("fullName email role");
    if (!staff) return send(res, 404, false, "Staff member not found");

    const documents = await StaffDocument.find({ staff: staffId })
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "fullName role")
      .lean();

    return send(res, 200, true, "Staff documents fetched", {
      staff,
      documents,
    });
  } catch (error) {
    console.error("getStaffDocuments error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getMyStaffDocuments = (req, res) => {
  req.params.id = req.user.id;
  return getStaffDocuments(req, res);
};

const createStaffDocument = async (req, res) => {
  try {
    const staffId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return send(res, 400, false, "Invalid staff ID");
    }

    const staff = await User.findOne({ _id: staffId, role: { $ne: "student" } }).select("_id");
    if (!staff) return send(res, 404, false, "Staff member not found");

    const {
      documentType,
      title,
      fileUrl,
      publicId,
      fileName,
      mimeType,
      note,
    } = req.body;

    if (!DOCUMENT_TYPES.has(documentType) || !title || !fileUrl) {
      return send(res, 400, false, "Valid documentType, title and fileUrl are required");
    }

    if (
      typeof title !== "string" ||
      title.trim().length > 150 ||
      typeof fileUrl !== "string" ||
      fileUrl.length > 2000
    ) {
      return send(res, 400, false, "Invalid document metadata");
    }

    const document = await StaffDocument.create({
      staff: staffId,
      documentType,
      title,
      fileUrl,
      publicId: publicId || "",
      fileName: fileName || "",
      mimeType: mimeType || "",
      uploadedBy: req.user.id,
      note: note || "",
    });

    return send(res, 201, true, "Staff document added", document);
  } catch (error) {
    console.error("createStaffDocument error:", error);
    return send(res, 500, false, "Server error");
  }
};

const deleteStaffDocument = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return send(res, 400, false, "Invalid document ID");
    }

    const document = await StaffDocument.findById(req.params.id);

    if (!document) {
      return send(res, 404, false, "Document not found");
    }

    const staff = await User.findOne({ _id: document.staff, role: { $ne: "student" } }).select("_id");
    if (!staff) return send(res, 404, false, "Staff member not found");

    await document.deleteOne();

    return send(res, 200, true, "Staff document deleted");
  } catch (error) {
    console.error("deleteStaffDocument error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  getStaffDocuments,
  getMyStaffDocuments,
  createStaffDocument,
  deleteStaffDocument,
};

// controllers/studentDocument.controller.js
const StudentDocument = require("../models/StudentDocument");
const { DOCUMENT_TYPES } = require("../models/StudentDocument");
const cloudinary = require("../config/Cloudinary");

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const uploadBufferToCloudinary = (buffer, folder, resourceType, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, ...(publicId ? { public_id: publicId } : {}) },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

const destroyCloudinaryAsset = (publicId, resourceType = "image") =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType }).catch(() => {});

const resolveFileType = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype === "application/pdf") return "pdf";
  return "doc";
};

const resolveCloudinaryResourceType = (mimetype) =>
  mimetype.startsWith("image/") ? "image" : "raw";

// ── GET /api/student/documents — returns all 6 fixed slots, filled or empty ──
const getMyDocuments = async (req, res) => {
  try {
    const docs = await StudentDocument.find({ student: req.user.id });
    const docMap = new Map(docs.map((d) => [d.type, d]));

    const merged = DOCUMENT_TYPES.map((type) => {
      const existing = docMap.get(type);
      if (!existing) {
        return {
          id: type,
          status: "empty",
          fileType: null,
          fileSize: null,
          uploadedAt: null,
          fileUrl: null,
          note: null,
        };
      }
      return {
        id: type,
        status: existing.status,
        fileType: existing.fileType,
        fileSize: existing.fileSize,
        uploadedAt: existing.updatedAt,
        fileUrl: existing.fileUrl,
        note: existing.note || null,
      };
    });

    return send(res, 200, true, "Documents fetched", merged);
  } catch (error) {
    console.error("getMyDocuments error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── POST /api/student/documents/:type — upload (or replace) a document ──
const uploadDocument = async (req, res) => {
  try {
    const { type } = req.params;
    if (!DOCUMENT_TYPES.includes(type)) {
      return send(res, 400, false, "Invalid document type");
    }
    if (!req.file) {
      return send(res, 400, false, "No file received");
    }

    const existing = await StudentDocument.findOne({ student: req.user.id, type });

    // Delete the old Cloudinary asset if this is a replace
    if (existing) {
      const oldResourceType = existing.fileType === "image" ? "image" : "raw";
      await destroyCloudinaryAsset(existing.publicId, oldResourceType);
    }

    const resourceType = resolveCloudinaryResourceType(req.file.mimetype);
    const uploaded = await uploadBufferToCloudinary(
      req.file.buffer,
      `deepScode/student-documents/${req.user.id}`,
      resourceType,
      `${type}-${Date.now()}`
    );

    const payload = {
      student: req.user.id,
      type,
      fileUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      fileType: resolveFileType(req.file.mimetype),
      fileSize: req.file.size,
      originalName: req.file.originalname,
      status: "under_review",
      note: "",
      uploadedBy: req.user.id,
      reviewedBy: null,
      reviewedAt: null,
    };

    const doc = await StudentDocument.findOneAndUpdate(
      { student: req.user.id, type },
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    );

    return send(res, existing ? 200 : 201, true, existing ? "Document replaced" : "Document uploaded", {
      id: doc.type,
      status: doc.status,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadedAt: doc.updatedAt,
      fileUrl: doc.fileUrl,
      note: doc.note || null,
    });
  } catch (error) {
    console.error("uploadDocument error:", error);
    return send(res, 500, false, "Server error");
  }
};

// ── DELETE /api/student/documents/:type ──
const deleteDocument = async (req, res) => {
  try {
    const { type } = req.params;
    if (!DOCUMENT_TYPES.includes(type)) {
      return send(res, 400, false, "Invalid document type");
    }

    const doc = await StudentDocument.findOne({ student: req.user.id, type });
    if (!doc) return send(res, 404, false, "Document not found");

    const resourceType = doc.fileType === "image" ? "image" : "raw";
    await destroyCloudinaryAsset(doc.publicId, resourceType);
    await StudentDocument.deleteOne({ _id: doc._id });

    return send(res, 200, true, "Document deleted");
  } catch (error) {
    console.error("deleteDocument error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = { getMyDocuments, uploadDocument, deleteDocument };
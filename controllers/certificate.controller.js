// controllers/certificate.controller.js
const mongoose = require("mongoose");
const Certificate = require("../models/Certificate");
const User = require("../models/User");
const StudentAssignment = require("../models/Studentassignment");
const cloudinary = require("../config/Cloudinary");
const { generateUniqueCertificateId } = require("../utils/generateCertificateId");
const generateCertificatePdf = require("../utils/generateCertificatePdf");
const { computeCertificateEligibility } = require("../utils/certificateEligibility");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const FRONTEND_URL = process.env.FRONTEND_URL || "https://deepScode.com";
const buildVerificationUrl = (certificateId) => `${FRONTEND_URL}/verify/${certificateId}`;

const uploadPdfToCloudinary = (buffer, certificateId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "deepScode/certificates",
        resource_type: "raw",
        public_id: certificateId,
        format: "pdf",
        overwrite: true,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

/* ============================ ADMIN ============================ */

// GET /api/admin/certificates
const getAllCertificates = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (search.trim()) {
      filter.$or = [
        { certificateId: { $regex: search.trim(), $options: "i" } },
        { studentName: { $regex: search.trim(), $options: "i" } },
        { courseName: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const [certificates, total] = await Promise.all([
      Certificate.find(filter)
        .populate("student", "fullName email studentId")
        .populate("course", "title")
        .populate("mentor", "fullName")
        .populate("issuedBy", "fullName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Certificate.countDocuments(filter),
    ]);

    return send(res, 200, true, "Certificates fetched", certificates, {
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAllCertificates error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/admin/certificates/students — lightweight list for the Issue modal
const getEligibleStudents = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const filter = { role: "student", status: "approved" };
    if (search.trim()) {
      filter.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
        { studentId: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const students = await User.find(filter).select("fullName email studentId").limit(50).lean();
    const studentIds = students.map((s) => s._id);

    const [assignments, existingCerts] = await Promise.all([
      StudentAssignment.find({ student: { $in: studentIds }, status: "active" })
        .populate("course", "title")
        .populate("mentor", "fullName")
        .lean(),
      Certificate.find({ student: { $in: studentIds } }).select("student status").lean(),
    ]);

    const assignmentMap = new Map(assignments.map((a) => [String(a.student), a]));
    const certMap = new Map(existingCerts.map((c) => [String(c.student), c.status]));

    const data = students.map((s) => {
      const a = assignmentMap.get(String(s._id));
      return {
        _id: s._id,
        fullName: s.fullName,
        email: s.email,
        studentId: s.studentId,
        course: a && a.course ? { _id: a.course._id, title: a.course.title } : null,
        mentor: a && a.mentor ? { _id: a.mentor._id, fullName: a.mentor.fullName } : null,
        hasCertificate: certMap.get(String(s._id)) === "issued",
      };
    });

    return send(res, 200, true, "Students fetched", data);
  } catch (error) {
    console.error("getEligibleStudents error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/admin/certificates/eligibility/:studentId
const getStudentEligibility = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    const student = await User.findOne({ _id: studentId, role: "student" }).select("fullName studentId");
    if (!student) return send(res, 404, false, "Student not found");

    const eligibility = await computeCertificateEligibility(studentId);
    return send(res, 200, true, "Eligibility fetched", { student, ...eligibility });
  } catch (error) {
    console.error("getStudentEligibility error:", error);
    return send(res, 500, false, "Server error");
  }
};

// POST /api/admin/certificates   body: { studentId }
const issueCertificate = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId || !isValidId(studentId)) {
      return send(res, 400, false, "A valid studentId is required");
    }

    const student = await User.findOne({ _id: studentId, role: "student" });
    if (!student) return send(res, 404, false, "Student not found");

    const assignment = await StudentAssignment.findOne({ student: studentId, status: "active" })
      .populate("course", "title")
      .populate("mentor", "fullName");

    if (!assignment || !assignment.course) {
      return send(
        res,
        400,
        false,
        "This student has no assigned course. Assign a course before issuing a certificate."
      );
    }

    const eligibility = await computeCertificateEligibility(studentId);
    if (!eligibility.eligible) {
      return send(res, 403, false, "Student is not eligible to receive a certificate.", eligibility);
    }

    const existing = await Certificate.findOne({ student: studentId, course: assignment.course._id });
    if (existing && existing.status === "issued") {
      return send(
        res,
        409,
        false,
        "A certificate has already been issued to this student for this course.",
        existing
      );
    }

    const certificateId = existing ? existing.certificateId : await generateUniqueCertificateId();
    const verificationUrl = buildVerificationUrl(certificateId);
    const issueDate = new Date();

    let pdfBuffer;
    try {
      pdfBuffer = await generateCertificatePdf({
        studentName: student.fullName,
        courseName: assignment.course.title,
        certificateId,
        issueDate,
      });
    } catch (pdfErr) {
      console.error("generateCertificatePdf error:", pdfErr);
      return send(res, 500, false, "Failed to generate the certificate PDF. Please try again.");
    }

    let uploadResult;
    try {
      uploadResult = await uploadPdfToCloudinary(pdfBuffer, certificateId);
    } catch (uploadErr) {
      console.error("Cloudinary upload error:", uploadErr);
      return send(res, 502, false, "Failed to upload the certificate PDF. Please try again.");
    }

    const payload = {
      certificateId,
      student: student._id,
      course: assignment.course._id,
      mentor: assignment.mentor ? assignment.mentor._id : null,
      issuedBy: req.user.id,
      studentName: student.fullName,
      courseName: assignment.course.title,
      mentorName: assignment.mentor ? assignment.mentor.fullName : "",
      issueDate,
      verificationCode: certificateId,
      verificationUrl,
      pdfUrl: uploadResult.secure_url,
      pdfPublicId: uploadResult.public_id,
      status: "issued",
      verified: true,
      revokedAt: null,
      revokedBy: null,
      revokeReason: "",
    };

    let certificate;
    if (existing) {
      Object.assign(existing, payload);
      certificate = await existing.save();
    } else {
      certificate = await Certificate.create(payload);
    }

    const populated = await Certificate.findById(certificate._id)
      .populate("student", "fullName email studentId")
      .populate("course", "title")
      .populate("mentor", "fullName")
      .populate("issuedBy", "fullName");

    return send(res, existing ? 200 : 201, true, "Certificate issued successfully", populated);
  } catch (error) {
    console.error("issueCertificate error:", error);
    if (error.code === 11000) {
      return send(res, 409, false, "A certificate already exists for this student and course.");
    }
    return send(res, 500, false, "Server error while issuing certificate");
  }
};

// GET /api/admin/certificates/:id
const getCertificateById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid certificate ID");

    const certificate = await Certificate.findById(id)
      .populate("student", "fullName email studentId")
      .populate("course", "title")
      .populate("mentor", "fullName")
      .populate("issuedBy", "fullName");

    if (!certificate) return send(res, 404, false, "Certificate not found");
    return send(res, 200, true, "Certificate fetched", certificate);
  } catch (error) {
    console.error("getCertificateById error:", error);
    return send(res, 500, false, "Server error");
  }
};

// PATCH /api/admin/certificates/:id/revoke
const revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "" } = req.body;
    if (!isValidId(id)) return send(res, 400, false, "Invalid certificate ID");

    const certificate = await Certificate.findById(id);
    if (!certificate) return send(res, 404, false, "Certificate not found");
    if (certificate.status === "revoked") return send(res, 400, false, "Certificate is already revoked");

    certificate.status = "revoked";
    certificate.verified = false;
    certificate.revokedAt = new Date();
    certificate.revokedBy = req.user.id;
    certificate.revokeReason = reason;
    await certificate.save();

    return send(res, 200, true, "Certificate revoked successfully", certificate);
  } catch (error) {
    console.error("revokeCertificate error:", error);
    return send(res, 500, false, "Server error");
  }
};

/* ============================ STUDENT ============================ */

// GET /api/student/certificates
const getMyCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find({ student: req.user.id })
      .populate("course", "title")
      .populate("mentor", "fullName")
      .sort({ issueDate: -1 });

    return send(res, 200, true, "Certificates fetched", certificates);
  } catch (error) {
    console.error("getMyCertificates error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/student/certificates/eligibility
const getMyEligibility = async (req, res) => {
  try {
    const eligibility = await computeCertificateEligibility(req.user.id);
    return send(res, 200, true, "Eligibility fetched", eligibility);
  } catch (error) {
    console.error("getMyEligibility error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/student/certificates/:id
const getMyCertificateById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid certificate ID");

    // Identity resolved from the JWT, never from the frontend
    const certificate = await Certificate.findOne({ _id: id, student: req.user.id })
      .populate("course", "title")
      .populate("mentor", "fullName");

    if (!certificate) return send(res, 404, false, "Certificate not found");
    return send(res, 200, true, "Certificate fetched", certificate);
  } catch (error) {
    console.error("getMyCertificateById error:", error);
    return send(res, 500, false, "Server error");
  }
};

// GET /api/student/certificates/:id/download
//
// Returns the URL of the PDF that was generated ONCE at issue time. This
// never regenerates the PDF — it just hands back the stored Cloudinary URL,
// so every download (and every dashboard preview) is byte-for-byte the same
// file.
const downloadMyCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid certificate ID");

    const certificate = await Certificate.findOne({ _id: id, student: req.user.id });
    if (!certificate) return send(res, 404, false, "Certificate not found");
    if (certificate.status === "revoked") return send(res, 410, false, "This certificate has been revoked");
    if (!certificate.pdfUrl) return send(res, 404, false, "Certificate PDF not available");

    return send(res, 200, true, "Download link fetched", { url: certificate.pdfUrl });
  } catch (error) {
    console.error("downloadMyCertificate error:", error);
    return send(res, 500, false, "Server error");
  }
};

/* ============================ PUBLIC ============================ */

// GET /api/verify/:certificateId — no auth
const verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    if (!certificateId) return send(res, 400, false, "Certificate ID is required");

    const certificate = await Certificate.findOne({
      certificateId: certificateId.trim().toUpperCase(),
    }).populate("course", "title");

    if (!certificate) {
      return send(res, 404, false, "No certificate found with this ID", { valid: false });
    }

    return send(res, 200, true, "Certificate verification result", {
      valid: certificate.status === "issued",
      certificateId: certificate.certificateId,
      studentName: certificate.studentName,
      courseName: certificate.course ? certificate.course.title : certificate.courseName,
      issueDate: certificate.issueDate,
      status: certificate.status,
      verified: certificate.status === "issued",
    });
  } catch (error) {
    console.error("verifyCertificate error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  getAllCertificates,
  getEligibleStudents,
  getStudentEligibility,
  issueCertificate,
  getCertificateById,
  revokeCertificate,
  getMyCertificates,
  getMyEligibility,
  getMyCertificateById,
  downloadMyCertificate,
  verifyCertificate,
};
// routes/certificate.routes.js
const express = require("express");
const adminRouter = express.Router();
const studentRouter = express.Router();
const publicRouter = express.Router();

const { auth, isAdmin, isStudent } = require("../middleware/auth.middleware");
const {
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
} = require("../controllers/certificate.controller");

// ── Admin ──
adminRouter.use(auth, isAdmin);
adminRouter.get("/students", getEligibleStudents);
adminRouter.get("/eligibility/:studentId", getStudentEligibility);
adminRouter.get("/", getAllCertificates);
adminRouter.post("/", issueCertificate);
adminRouter.get("/:id", getCertificateById);
adminRouter.patch("/:id/revoke", revokeCertificate);

// ── Student ──
studentRouter.use(auth, isStudent);
studentRouter.get("/eligibility", getMyEligibility);
studentRouter.get("/", getMyCertificates);
studentRouter.get("/:id", getMyCertificateById);
studentRouter.get("/:id/download", downloadMyCertificate);

// ── Public ──
publicRouter.get("/:certificateId", verifyCertificate);

module.exports = { adminRouter, studentRouter, publicRouter };
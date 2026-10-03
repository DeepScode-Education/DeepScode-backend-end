// utils/generateCertificateId.js
//
// Generates a unique, professional-format certificate ID: SLT-CERT-XXXXXX
// Backend-only — the frontend/admin never supplies this.

const Certificate = require("../models/Certificate");

const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 ambiguity

const randomSegment = (length = 6) => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
};

const generateUniqueCertificateId = async () => {
  let certificateId;
  let exists = true;

  while (exists) {
    certificateId = `SLT-CERT-${randomSegment(6)}`;
    // eslint-disable-next-line no-await-in-loop
    exists = await Certificate.findOne({ certificateId }).select("_id").lean();
  }

  return certificateId;
};

module.exports = { generateUniqueCertificateId };
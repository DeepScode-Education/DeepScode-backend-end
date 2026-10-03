// models/PhoneOtp.js
//
// Server-side record of a MSG91-verified mobile number. MSG91's Custom UI
// widget handles OTP send/verify entirely on the client and hands back an
// "access-token" on success — we never see the raw OTP. This model exists
// so that after we independently confirm that access-token with MSG91's
// server (see controllers/phoneOtp.controller.js), we have something
// durable to check against when /api/inquiries is submitted a few moments
// later — mirroring the existing EmailOtp pattern exactly.

const mongoose = require("mongoose");

const phoneOtpSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

phoneOtpSchema.index({ mobileNumber: 1 });

// TTL cleanup — Mongo drops the document itself once expiresAt has passed,
// same pattern as other short-lived verification records in this codebase.
phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PhoneOtp", phoneOtpSchema);
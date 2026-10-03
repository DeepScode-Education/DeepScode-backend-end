// controllers/phoneOtp.controller.js

const axios = require("axios");
const PhoneOtp = require("../models/PhoneOtp");

const MSG91_VERIFY_TOKEN_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";
const MOBILE_REGEX = /^[6-9]\d{9}$/;

const verifyAccessToken = async (req, res) => {
  try {
    const { mobileNumber, accessToken } = req.body;

    if (!mobileNumber || !MOBILE_REGEX.test(String(mobileNumber).trim())) {
      return res.status(400).json({
        success: false,
        message: "A valid 10-digit mobile number is required",
      });
    }

    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      return res.status(400).json({
        success: false,
        message: "accessToken is required",
      });
    }

    if (!process.env.MSG91_AUTHKEY) {
      console.error("[phoneOtp] MSG91_AUTHKEY is not configured on the server");
      return res.status(500).json({
        success: false,
        message: "Phone verification is temporarily unavailable. Please try again shortly.",
      });
    }

    const normalizedMobile = String(mobileNumber).trim();

    // ── Diagnostic logs (remove after confirming it works) ──────────────────
    console.log("[phoneOtp] mobileNumber:", normalizedMobile);
    console.log("[phoneOtp] accessToken length:", accessToken.trim().length);
    console.log("[phoneOtp] accessToken preview:", accessToken.trim().slice(0, 20) + "...");
    console.log("[phoneOtp] MSG91_AUTHKEY present:", !!process.env.MSG91_AUTHKEY);
    console.log("[phoneOtp] MSG91_AUTHKEY length:", process.env.MSG91_AUTHKEY?.length);

    let msg91Response;
    try {
      msg91Response = await axios.post(
        MSG91_VERIFY_TOKEN_URL,
        {
          // ✅ FIX: only access-token in the body — authkey goes in the header
          "access-token": accessToken.trim(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            // ✅ FIX: authkey as HTTP header, NOT in the body
            "authkey": process.env.MSG91_AUTHKEY,
          },
        }
      );
    } catch (err) {
      console.error(
        "[phoneOtp] MSG91 verifyAccessToken request failed:",
        err.response?.data || err.message
      );
      return res.status(400).json({
        success: false,
        message: "Could not verify your mobile number with the SMS provider. Please try again.",
      });
    }

    const { type, message } = msg91Response.data || {};

    console.log("[phoneOtp] MSG91 verifyAccessToken response:", msg91Response.data);

    if (type !== "success") {
      console.warn("[phoneOtp] MSG91 rejected access-token:", msg91Response.data);
      return res.status(400).json({
        success: false,
        message: message || "Mobile number verification failed. Please try again.",
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await PhoneOtp.findOneAndDelete({ mobileNumber: normalizedMobile });
    await PhoneOtp.create({
      mobileNumber: normalizedMobile,
      verified: true,
      verifiedAt: new Date(),
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      message: "Mobile number verified successfully",
    });
  } catch (error) {
    console.error("[phoneOtp] verifyAccessToken error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while verifying mobile number",
    });
  }
};

module.exports = { verifyAccessToken };

const Otp = require("../models/Otp.model");
const User = require("../models/User");

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Valid phone number is required",
      });
    }

    const existingUser = await User.findOne({ phone, isPhoneVerified: true });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.deleteMany({ phone });
    await Otp.create({ phone, otp, expiresAt });

    console.log(`[OTP] Phone: ${phone} -> OTP: ${otp}`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required",
      });
    }

    const otpRecord = await Otp.findOne({ phone, otp });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP expired, please request a new one" });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return res.status(200).json({ success: true, message: "Phone number verified successfully" });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { sendOtp, verifyOtp };
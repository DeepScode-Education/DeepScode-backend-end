const EmailOtp = require("../models/EmailOtp");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// SEND OTP
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("📩 OTP Request Received:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    console.log("🔑 Generated OTP:", otp);

    await EmailOtp.findOneAndDelete({ email });

    const otpDoc = await EmailOtp.create({
      email,
      otp,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    console.log("💾 OTP Saved:", otpDoc);

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: "deepScode Email Verification",
      html: `
        <div style="font-family:sans-serif">
          <h2>deepScode</h2>
          <p>Your verification code is:</p>
          <h1>${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
    });

    console.log("📧 Resend Response:", result);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("❌ sendOtp error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// VERIFY OTP
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpDoc = await EmailOtp.findOne({ email });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "OTP not found",
      });
    }

    if (otpDoc.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (otpDoc.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    otpDoc.verified = true;
    await otpDoc.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("verifyOtp error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
};
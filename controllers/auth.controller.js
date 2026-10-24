// const bcrypt   = require("bcryptjs");
// const jwt      = require("jsonwebtoken");
// const crypto   = require("crypto");
// const { Resend } = require("resend");
// const User     = require("../models/User");
// const EmailOtp = require("../models/EmailOtp");
// const { checkFeeLoginEligibility } = require("./Fee.controller");

// const resend = new Resend(process.env.RESEND_API_KEY);

// // ─── Helpers ───────────────────────────────────────────────────────────────────

// const SALT_ROUNDS = 10;

// const signToken = (user) =>
//   jwt.sign(
//     {
//       id:     user._id,
//       role:   user.role,
//       branch: user.branch ?? null,
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
//   );

// const looksLikeEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

// // ─── POST /api/auth/register ───────────────────────────────────────────────────
// const register = async (req, res) => {
//   try {
//     const { fullName, email, password } = req.body;

//     const normalizedEmail = email.toLowerCase().trim();

//     const existingUser = await User.findOne({ email: normalizedEmail });
//     if (existingUser) {
//       return res.status(409).json({
//         success: false,
//         message: "An account with this email already exists.",
//       });
//     }

//     const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });

//     if (!otpRecord || !otpRecord.verified) {
//       return res.status(400).json({
//         success: false,
//         message: "Email not verified. Please verify your email with an OTP first.",
//       });
//     }

//     const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

//     const user = await User.create({
//       fullName: fullName.trim(),
//       email:    normalizedEmail,
//       password: hashedPassword,
//       role:     "student",
//       status:   "pending",
//     });

//     await EmailOtp.findOneAndDelete({ email: normalizedEmail });

//     return res.status(201).json({
//       success: true,
//       message:
//         "Registration successful! Your application is under review. " +
//         "You will receive a Student ID once an admin approves your account.",
//       data: {
//         id:       user._id,
//         fullName: user.fullName,
//         email:    user.email,
//         role:     user.role,
//         status:   user.status,
//       },
//     });
//   } catch (error) {
//     console.error("[register] error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── POST /api/auth/login ──────────────────────────────────────────────────────
// const login = async (req, res) => {
//   try {
//     const { identifier, password } = req.body;

//     const trimmed = identifier.trim();
//     const isEmail = looksLikeEmail(trimmed);

//     console.log("\n🔐 [LOGIN] Attempt received");
//     console.log("   identifier:", trimmed, "| isEmail:", isEmail);

//     let user;

//     if (isEmail) {
//       user = await User.findOne({ email: trimmed.toLowerCase() }).select("+password");

//       if (user && user.role === "student") {
//         console.log("❌ [LOGIN] Blocked — student tried email login");
//         return res.status(403).json({
//           success: false,
//           message: "Students must log in with their Student ID, not email.",
//         });
//       }
//     } else {
//       user = await User.findOne({ studentId: trimmed }).select("+password");

//       if (user && user.role !== "student") {
//         console.log("❌ [LOGIN] Blocked — non-student tried studentId login");
//         return res.status(400).json({
//           success: false,
//           message: "Invalid credentials.",
//         });
//       }
//     }

//     if (!user) {
//       console.log("❌ [LOGIN] No user found for identifier:", trimmed);
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials.",
//       });
//     }

//     console.log(`👤 [LOGIN] User found → ${user.fullName} (role: ${user.role}, status: ${user.status}, isActive: ${user.isActive})`);
//     console.log(`🔑 [LOGIN] Stored hash: ${user.password}`);
//     console.log(`🔑 [LOGIN] Comparing against typed password (length: ${password?.length ?? 0})`);

//     const passwordMatch = await bcrypt.compare(password, user.password);

//     console.log(`🔍 [LOGIN] bcrypt.compare result: ${passwordMatch}`);

//     if (!passwordMatch) {
//       console.log("❌ [LOGIN] Password MISMATCH — invalid credentials\n");
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials.",
//       });
//     }

//     if (!user.isActive) {
//       console.log("❌ [LOGIN] Account deactivated\n");
//       return res.status(403).json({
//         success: false,
//         message: "Your account has been deactivated. Please contact the admin.",
//       });
//     }

//     if (user.role === "student") {
//       if (user.status === "pending") {
//         console.log("❌ [LOGIN] Student pending approval\n");
//         return res.status(403).json({
//           success: false,
//           message:
//             "Your account is pending admin approval. " +
//             "You will be notified once approved.",
//         });
//       }
//       if (user.status === "rejected") {
//         console.log("❌ [LOGIN] Student registration rejected\n");
//         return res.status(403).json({
//           success: false,
//           message: "Your registration was not approved. Please contact the admin.",
//         });
//       }

//       const feeCheck = await checkFeeLoginEligibility(user._id);
//       if (feeCheck.blocked) {
//         console.log("❌ [LOGIN] Blocked — fee pending\n");
//         return res.status(402).json({
//           success: false,
//           errorCode: "FEE_PENDING",
//           message: feeCheck.message,
//           data: {
//             feeStatus:       feeCheck.feeStatus,
//             totalFees:       feeCheck.totalFees,
//             totalPaid:       feeCheck.totalPaid,
//             remainingAmount: feeCheck.remainingAmount,
//             nextDueDate:     feeCheck.nextDueDate,
//           },
//         });
//       }
//     }

//     const token = signToken(user);

//     User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).catch(() => {});

//     console.log(`✅ [LOGIN] Success → ${user.email || user.studentId} logged in as ${user.role}\n`);

//     return res.status(200).json({
//       success: true,
//       message: "Login successful.",
//       token,
//       user: {
//         id:               user._id,
//         fullName:         user.fullName,
//         email:            user.email,
//         role:             user.role,
//         branch:           user.branch,
//         studentId:        user.studentId  ?? null,
//         status:           user.status,
//         profileCompleted: user.profileCompleted,
//         lastLoginAt:      user.lastLoginAt,
//       },
//     });
//   } catch (error) {
//     console.error("❌ [LOGIN] Unexpected error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── GET /api/auth/me ───────────────────────────────────────────────────────────
// const getMe = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id)
//       .select("-password")
//       .populate("branch", "name code");

//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found." });
//     }

//     return res.status(200).json({ success: true, data: user });
//   } catch (error) {
//     console.error("[getMe] error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// // ─── POST /api/auth/forgot-password ────────────────────────────────────────────
// // Accepts an email (staff/admin) — students don't have email-based login, so
// // this flow is for staff roles. Always returns a generic success message,
// // even if the email doesn't exist, to avoid leaking which emails are registered.
// // ─── POST /api/auth/forgot-password ────────────────────────────────────────────
// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     console.log("\n🔑 [FORGOT PASSWORD] Request received for:", email);

//     if (!email || !looksLikeEmail(email.trim())) {
//       console.log("❌ [FORGOT PASSWORD] Invalid email format:", email);
//       return res.status(400).json({
//         success: false,
//         message: "Please enter a valid email address.",
//       });
//     }

//     const normalizedEmail = email.toLowerCase().trim();
//     const user = await User.findOne({ email: normalizedEmail });

//     if (!user) {
//       console.log("❌ [FORGOT PASSWORD] No account found for:", normalizedEmail);
//       return res.status(404).json({
//         success: false,
//         message: "No account found with this email address.",
//       });
//     }

//     console.log(`👤 [FORGOT PASSWORD] User found → ${user.fullName} (role: ${user.role})`);

//     if (!user.isActive) {
//       console.log("❌ [FORGOT PASSWORD] Account deactivated:", normalizedEmail);
//       return res.status(403).json({
//         success: false,
//         message: "This account has been deactivated. Please contact the admin.",
//       });
//     }

//     const rawToken = crypto.randomBytes(32).toString("hex");
//     const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

//     user.resetPasswordToken = hashedToken;
//     user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
//     await user.save();

//     console.log("💾 [FORGOT PASSWORD] Reset token saved to DB (expires in 30 min)");
//     console.log("🔗 [FORGOT PASSWORD] Raw token (for testing only):", rawToken);

//     const frontendBaseUrl = process.env.FRONTEND_URL || "https://slate-academy.com";
//     const resetUrl = `${frontendBaseUrl}/reset-password/${rawToken}`;

//     console.log("🌐 [FORGOT PASSWORD] Reset URL:", resetUrl);

//     try {
//       const emailResult = await resend.emails.send({
//         from: process.env.RESEND_FROM_EMAIL,
//         to: normalizedEmail,
//         subject: "Reset Your Slate Academy Password",
//         html: `
//           <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
//             <h2>Password Reset Request</h2>
//             <p>Hi ${user.fullName},</p>
//             <p>We received a request to reset your Slate Academy account password. Click the button below to set a new password. This link will expire in 30 minutes.</p>
//             <p style="margin: 24px 0;">
//               <a href="${resetUrl}" style="background-color:#0037FF; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
//                 Reset Password
//               </a>
//             </p>
//             <p>If the button doesn't work, copy and paste this link into your browser:</p>
//             <p style="word-break:break-all; color:#0037FF;">${resetUrl}</p>
//             <p>If you didn't request this, you can safely ignore this email — your password will remain unchanged.</p>
//           </div>
//         `,
//       });

//       console.log("📧 [FORGOT PASSWORD] Resend API response:", emailResult);
//       console.log(`✅ [FORGOT PASSWORD] Email sent successfully to ${normalizedEmail}\n`);
//     } catch (mailErr) {
//       console.error("❌ [FORGOT PASSWORD] Email send FAILED:", mailErr.message);

//       user.resetPasswordToken = null;
//       user.resetPasswordExpires = null;
//       await user.save();

//       console.log("🧹 [FORGOT PASSWORD] Rolled back reset token due to email failure\n");

//       return res.status(500).json({
//         success: false,
//         message: "Failed to send reset email. Please try again in a moment.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: `A password reset link has been sent to ${normalizedEmail}.`,
//     });
//   } catch (error) {
//     console.error("❌ [FORGOT PASSWORD] Unexpected error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };
// // ─── POST /api/auth/reset-password/:token ──────────────────────────────────────
// // ─── POST /api/auth/reset-password/:token ──────────────────────────────────────
// const resetPassword = async (req, res) => {
//   try {
//     const { token } = req.params;
//     const { password } = req.body;

//     console.log("\n🔓 [RESET PASSWORD] Request received with token:", token);

//     if (!token) {
//       console.log("❌ [RESET PASSWORD] No token provided");
//       return res.status(400).json({ success: false, message: "Reset token is missing." });
//     }

//     if (!password || password.trim().length < 8) {
//       console.log("❌ [RESET PASSWORD] Password too short");
//       return res.status(400).json({
//         success: false,
//         message: "Password must be at least 8 characters.",
//       });
//     }

//     const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

//     const user = await User.findOne({
//       resetPasswordToken: hashedToken,
//       resetPasswordExpires: { $gt: new Date() },
//     }).select("+password +resetPasswordToken +resetPasswordExpires");

//     if (!user) {
//       console.log("❌ [RESET PASSWORD] Invalid or expired token");
//       return res.status(400).json({
//         success: false,
//         message: "This reset link is invalid or has expired. Please request a new one.",
//       });
//     }

//     console.log(`👤 [RESET PASSWORD] Token valid → resetting password for ${user.fullName} (${user.email})`);

//     const hashedPassword = await bcrypt.hash(password.trim(), SALT_ROUNDS);

//     user.password = hashedPassword;
//     user.resetPasswordToken = null;
//     user.resetPasswordExpires = null;
//     await user.save();

//     console.log(`✅ [RESET PASSWORD] Password updated successfully in MongoDB for ${user.email}`);

//     try {
//       const confirmResult = await resend.emails.send({
//         from: process.env.RESEND_FROM_EMAIL,
//         to: user.email,
//         subject: "Your Slate Academy Password Was Changed",
//         html: `
//           <div style="font-family:sans-serif">
//             <h2>Password Changed</h2>
//             <p>Hi ${user.fullName},</p>
//             <p>This is a confirmation that your Slate Academy account password was just changed. If this wasn't you, please contact the admin immediately.</p>
//           </div>
//         `,
//       });
//       console.log("📧 [RESET PASSWORD] Confirmation email sent:", confirmResult);
//     } catch (mailErr) {
//       console.error("⚠️ [RESET PASSWORD] Confirmation email failed (non-blocking):", mailErr.message);
//     }

//     console.log(`🎉 [RESET PASSWORD] Flow complete for ${user.email}\n`);

//     return res.status(200).json({
//       success: true,
//       message: "Your password has been reset successfully. You can now log in with your new password.",
//     });
//   } catch (error) {
//     console.error("❌ [RESET PASSWORD] Unexpected error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── GET /api/auth/verify-reset-token/:token ───────────────────────────────────
// // Lets the frontend check token validity before showing the reset form,
// // so the user doesn't fill out a form only to fail at submit time.
// const verifyResetToken = async (req, res) => {
//   try {
//     const { token } = req.params;

//     if (!token) {
//       return res.status(400).json({ success: false, valid: false, message: "Token is missing." });
//     }

//     const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

//     const user = await User.findOne({
//       resetPasswordToken: hashedToken,
//       resetPasswordExpires: { $gt: new Date() },
//     }).select("_id");

//     if (!user) {
//       return res.status(200).json({ success: true, valid: false });
//     }

//     return res.status(200).json({ success: true, valid: true });
//   } catch (error) {
//     console.error("[verifyResetToken] error:", error);
//     return res.status(500).json({ success: false, valid: false, message: "Internal server error." });
//   }
// };

// module.exports = {
//   register,
//   login,
//   getMe,
//   getProfile: getMe,
//   forgotPassword,
//   resetPassword,
//   verifyResetToken,
// };



const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const { Resend } = require("resend");
const User     = require("../models/User");
const EmailOtp = require("../models/EmailOtp");
const { checkFeeLoginEligibility } = require("./Fee.controller");

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;

const signToken = (user) =>
  jwt.sign(
    {
      id:     user._id,
      role:   user.role,
      branch: user.branch ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const looksLikeEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

// ─── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const otpRecord = await EmailOtp.findOne({ email: normalizedEmail });

    if (!otpRecord || !otpRecord.verified) {
      return res.status(400).json({
        success: false,
        message: "Email not verified. Please verify your email with an OTP first.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      fullName: fullName.trim(),
      email:    normalizedEmail,
      password: hashedPassword,
      role:     "student",
      status:   "pending",
    });

    await EmailOtp.findOneAndDelete({ email: normalizedEmail });

    return res.status(201).json({
      success: true,
      message:
        "Registration successful! Your application is under review. " +
        "You will receive a Student ID once an admin approves your account.",
      data: {
        id:       user._id,
        fullName: user.fullName,
        email:    user.email,
        role:     user.role,
        status:   user.status,
      },
    });
  } catch (error) {
    console.error("[register] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const trimmed = identifier.trim();
    const isEmail = looksLikeEmail(trimmed);

    console.log("\n🔐 [LOGIN] Attempt received");
    console.log("   identifier:", trimmed, "| isEmail:", isEmail);

    let user;

    if (isEmail) {
      user = await User.findOne({ email: trimmed.toLowerCase() }).select("+password");

      if (user && user.role === "student") {
        console.log("❌ [LOGIN] Blocked — student tried email login");
        return res.status(403).json({
          success: false,
          message: "Students must log in with their Student ID, not email.",
        });
      }
    } else {
      user = await User.findOne({ studentId: trimmed }).select("+password");

      if (user && user.role !== "student") {
        console.log("❌ [LOGIN] Blocked — non-student tried studentId login");
        return res.status(400).json({
          success: false,
          message: "Invalid credentials.",
        });
      }
    }

    if (!user) {
      console.log("❌ [LOGIN] No user found for identifier:", trimmed);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    console.log(`👤 [LOGIN] User found → ${user.fullName} (role: ${user.role}, status: ${user.status}, isActive: ${user.isActive})`);

    const passwordMatch = await bcrypt.compare(password, user.password);

    console.log(`🔍 [LOGIN] bcrypt.compare result: ${passwordMatch}`);

    if (!passwordMatch) {
      console.log("❌ [LOGIN] Password MISMATCH — invalid credentials\n");
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    if (!user.isActive) {
      console.log("❌ [LOGIN] Account deactivated\n");
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact the admin.",
      });
    }

    if (user.role === "student") {
      if (user.status === "pending") {
        console.log("❌ [LOGIN] Student pending approval\n");
        return res.status(403).json({
          success: false,
          message:
            "Your account is pending admin approval. " +
            "You will be notified once approved.",
        });
      }
      if (user.status === "rejected") {
        console.log("❌ [LOGIN] Student registration rejected\n");
        return res.status(403).json({
          success: false,
          message: "Your registration was not approved. Please contact the admin.",
        });
      }

      const feeCheck = await checkFeeLoginEligibility(user._id);
      if (feeCheck.blocked) {
        console.log("❌ [LOGIN] Blocked — fee pending\n");
        return res.status(402).json({
          success: false,
          errorCode: "FEE_PENDING",
          message: feeCheck.message,
          data: {
            feeStatus:       feeCheck.feeStatus,
            totalFees:       feeCheck.totalFees,
            totalPaid:       feeCheck.totalPaid,
            remainingAmount: feeCheck.remainingAmount,
            nextDueDate:     feeCheck.nextDueDate,
          },
        });
      }
    }

    const token = signToken(user);

    User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).catch(() => {});

    console.log(`✅ [LOGIN] Success → ${user.email || user.studentId} logged in as ${user.role}\n`);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id:               user._id,
        fullName:         user.fullName,
        email:            user.email,
        role:             user.role,
        branch:           user.branch,
        studentId:        user.studentId  ?? null,
        status:           user.status,
        profileCompleted: user.profileCompleted,
        lastLoginAt:      user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("[login] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── GET /api/auth/me ───────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("branch", "name code");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("[getMe] error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /api/auth/forgot-password ────────────────────────────────────────────
// Step 1: user enters email → we send a 6-digit OTP to that email.
// Works for ALL roles (student, mentor, counsellor, admin, super_admin,
// accountant) as long as they have an email on file. If the email isn't
// registered, we tell them directly (per your requirement).
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("\n🔑 [FORGOT PASSWORD] Request received for:", email);

    if (!email || !looksLikeEmail(email.trim())) {
      console.log("❌ [FORGOT PASSWORD] Invalid email format:", email);
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log("❌ [FORGOT PASSWORD] No account found for:", normalizedEmail);
      return res.status(404).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    console.log(`👤 [FORGOT PASSWORD] User found → ${user.fullName} (role: ${user.role})`);

    if (!user.isActive) {
      console.log("❌ [FORGOT PASSWORD] Account deactivated:", normalizedEmail);
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated. Please contact the admin.",
      });
    }

    const otp = generateOtp();
    const hashedOtp = hashOtp(otp);

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    console.log("💾 [FORGOT PASSWORD] OTP saved to DB (expires in 10 min)");
    console.log("🔑 [FORGOT PASSWORD] Generated OTP (for testing only):", otp);

    try {
      const emailResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: normalizedEmail,
        subject: "Your deepScode Password Reset OTP",
        html: `
          <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${user.fullName},</p>
            <p>Use the OTP below to reset your deepScode account password. This code expires in 10 minutes.</p>
            <h1 style="letter-spacing:4px; background:#f1f2f4; padding:16px; text-align:center; border-radius:8px;">${otp}</h1>
            <p>If you didn't request this, you can safely ignore this email — your password will remain unchanged.</p>
          </div>
        `,
      });

      console.log("📧 [FORGOT PASSWORD] Resend API response:", emailResult);
      console.log(`✅ [FORGOT PASSWORD] OTP email sent successfully to ${normalizedEmail}\n`);
    } catch (mailErr) {
      console.error("❌ [FORGOT PASSWORD] Email send FAILED:", mailErr.message);

      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      await user.save();

      console.log("🧹 [FORGOT PASSWORD] Rolled back OTP due to email failure\n");

      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again in a moment.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `An OTP has been sent to ${normalizedEmail}.`,
    });
  } catch (error) {
    console.error("❌ [FORGOT PASSWORD] Unexpected error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── POST /api/auth/verify-reset-otp ───────────────────────────────────────────
// Step 2: user enters the OTP they received. We check it's correct and not
// expired, WITHOUT clearing it yet — the final reset-password step re-checks
// it again before actually changing the password.
const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("\n🔍 [VERIFY OTP] Request received for:", email, "| OTP:", otp);

    if (!email || !looksLikeEmail(email.trim())) {
      return res.status(400).json({ success: false, valid: false, message: "Please enter a valid email address." });
    }
    if (!otp || otp.trim().length !== 6) {
      return res.status(400).json({ success: false, valid: false, message: "Enter a valid 6-digit OTP." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+resetPasswordOtp +resetPasswordOtpExpires");

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      console.log("❌ [VERIFY OTP] No pending OTP for this email");
      return res.status(400).json({ success: true, valid: false, message: "No OTP request found. Please request a new OTP." });
    }

    if (user.resetPasswordOtpExpires < new Date()) {
      console.log("❌ [VERIFY OTP] OTP expired");
      return res.status(400).json({ success: true, valid: false, message: "This OTP has expired. Please request a new one." });
    }

    const hashedInputOtp = hashOtp(otp.trim());
    const isMatch = hashedInputOtp === user.resetPasswordOtp;

    console.log("🔍 [VERIFY OTP] Match result:", isMatch);

    if (!isMatch) {
      return res.status(400).json({ success: true, valid: false, message: "Incorrect OTP. Please try again." });
    }

    console.log("✅ [VERIFY OTP] OTP verified successfully\n");
    return res.status(200).json({ success: true, valid: true, message: "OTP verified." });
  } catch (error) {
    console.error("❌ [VERIFY OTP] Unexpected error:", error);
    return res.status(500).json({ success: false, valid: false, message: "Internal server error." });
  }
};

// ─── POST /api/auth/reset-password ─────────────────────────────────────────────
// Step 3: user submits email + otp + new password together. We re-verify
// the OTP (never trust the frontend to have verified it already), hash the
// new password with bcrypt, and overwrite it in MongoDB.
const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    console.log("\n🔓 [RESET PASSWORD] Request received for:", email);

    if (!email || !looksLikeEmail(email.trim())) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (!otp || otp.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Enter a valid 6-digit OTP." });
    }
    if (!password || password.trim().length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password +resetPasswordOtp +resetPasswordOtpExpires"
    );

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      console.log("❌ [RESET PASSWORD] No pending OTP for this email");
      return res.status(400).json({ success: false, message: "No OTP request found. Please request a new OTP." });
    }

    if (user.resetPasswordOtpExpires < new Date()) {
      console.log("❌ [RESET PASSWORD] OTP expired");
      return res.status(400).json({ success: false, message: "This OTP has expired. Please request a new one." });
    }

    const hashedInputOtp = hashOtp(otp.trim());
    if (hashedInputOtp !== user.resetPasswordOtp) {
      console.log("❌ [RESET PASSWORD] OTP mismatch");
      return res.status(400).json({ success: false, message: "Incorrect OTP." });
    }

    console.log(`👤 [RESET PASSWORD] OTP valid → resetting password for ${user.fullName} (${user.email})`);

    const hashedPassword = await bcrypt.hash(password.trim(), SALT_ROUNDS);

    user.password = hashedPassword;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    console.log(`✅ [RESET PASSWORD] Password updated successfully in MongoDB for ${user.email}`);

    try {
      const confirmResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: "Your deepScode Password Was Changed",
        html: `
          <div style="font-family:sans-serif">
            <h2>Password Changed</h2>
            <p>Hi ${user.fullName},</p>
            <p>This is a confirmation that your deepScode account password was just changed. If this wasn't you, please contact the admin immediately.</p>
          </div>
        `,
      });
      console.log("📧 [RESET PASSWORD] Confirmation email sent:", confirmResult);
    } catch (mailErr) {
      console.error("⚠️ [RESET PASSWORD] Confirmation email failed (non-blocking):", mailErr.message);
    }

    console.log(`🎉 [RESET PASSWORD] Flow complete for ${user.email}\n`);

    return res.status(200).json({
      success: true,
      message: "Your password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("❌ [RESET PASSWORD] Unexpected error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

module.exports = {
  register,
  login,
  getMe,
  getProfile: getMe,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};
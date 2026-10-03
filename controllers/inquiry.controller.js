// const Inquiry = require("../models/Inquiry");
// const mongoose = require("mongoose");
// const EmailOtp = require("../models/EmailOtp");

// const createInquiry = async (req, res) => {
//   try {
//     const { fullName, mobileNumber, email, course, source, remarks } = req.body;

//     const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

  
//     const STAFF_ROLES = ["super_admin", "admin", "counsellor", "mentor", "accountant"];
//     const isAuthenticatedStaffEntry =
//       req.user && STAFF_ROLES.includes(req.user.role);

//     if (!isAuthenticatedStaffEntry) {
//       // ── Public form flow — OTP-gated ──────────────────────────────────────
//       if (!normalizedEmail) {
//         return res.status(400).json({
//           success: false,
//           message: "Email is required",
//         });
//       }

//       const otpRecord = await EmailOtp.findOne({
//         email: normalizedEmail,
//         verified: true,
//       });

//       if (!otpRecord) {
//         return res.status(400).json({
//           success: false,
//           message: "Email verification required",
//         });
//       }

//       if (otpRecord.expiresAt < new Date()) {
//         return res.status(400).json({
//           success: false,
//           message: "OTP expired. Please verify again.",
//         });
//       }
//     }

//     // ── Duplicate check (only when email is present) ──────────────────────
//     if (normalizedEmail) {
//       const existing = await Inquiry.findOne({ email: normalizedEmail, course });
//       if (existing) {
//         return res.status(409).json({
//           success: false,
//           message: "You have already applied for this course.",
//         });
//       }
//     }

//     const inquiry = await Inquiry.create({
//       fullName,
//       mobileNumber,
//       email: normalizedEmail,
//       course,
//       source: source || "Website",
//       remarks: remarks || "",
//     });

//     if (normalizedEmail) {
//       await EmailOtp.findOneAndDelete({ email: normalizedEmail });
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Application submitted successfully!",
//       data: inquiry,
//     });
//   } catch (error) {
//     console.error("createInquiry error:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // GET /api/inquiries  — admin ke liye saari entries
// const getAllInquiries = async (req, res) => {
//   try {
//     const inquiries = await Inquiry.find().sort({ createdAt: -1 });
//     return res.status(200).json({ success: true, data: inquiries });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // GET /api/inquiries/:id  — single inquiry by ID
// const getInquiryById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid inquiry ID",
//       });
//     }

//     const inquiry = await Inquiry.findById(id);

//     if (!inquiry) {
//       return res.status(404).json({
//         success: false,
//         message: "Inquiry not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: inquiry,
//     });
//   } catch (error) {
//     console.error("getInquiryById error:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// module.exports = { createInquiry, getAllInquiries, getInquiryById };


const Inquiry = require("../models/Inquiry");
const mongoose = require("mongoose");
const PhoneOtp = require("../models/PhoneOtp");

const sanitizeInquiry = (inquiry) => {
  if (!inquiry) return null;
  const plain = inquiry.toObject ? inquiry.toObject() : inquiry;
  return {
    _id: plain._id,
    fullName: plain.fullName,
    mobileNumber: plain.mobileNumber,
    email: plain.email,
    course: plain.course,
    source: plain.source,
    remarks: plain.remarks,
    leadStatus: plain.leadStatus,
    priority: plain.priority,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

const createInquiry = async (req, res) => {
  try {
    const { fullName, mobileNumber, email, course, source, remarks } = req.body;

    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
    const normalizedMobile = mobileNumber ? String(mobileNumber).trim() : undefined;

    const STAFF_ROLES = ["super_admin", "admin", "counsellor", "mentor", "accountant"];
    const isAuthenticatedStaffEntry =
      req.user && STAFF_ROLES.includes(req.user.role);

    if (!isAuthenticatedStaffEntry) {
      // ── Public form flow — gated ONLY on phone OTP now. Email is no
      // longer OTP-verified; it's just a plain field submitted as-is
      // (EmailOtp check removed per updated frontend flow). ────────────────
      if (!normalizedMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number is required",
        });
      }

      const phoneRecord = await PhoneOtp.findOne({
        mobileNumber: normalizedMobile,
        verified: true,
      });

      if (!phoneRecord) {
        return res.status(400).json({
          success: false,
          message: "Mobile number verification required",
        });
      }

      if (phoneRecord.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Mobile OTP expired. Please verify your number again.",
        });
      }
    }

    // ── Duplicate check (only when email is present) ──────────────────────
    if (normalizedEmail) {
      const existing = await Inquiry.findOne({ email: normalizedEmail, course });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You have already applied for this course.",
        });
      }
    }

    const inquiry = await Inquiry.create({
      fullName,
      mobileNumber,
      email: normalizedEmail,
      course,
      source: source || "Website",
      remarks: remarks || "",
    });

    // ── Clear the used phone verification record ──────────────────────────
    if (!isAuthenticatedStaffEntry && normalizedMobile) {
      await PhoneOtp.findOneAndDelete({ mobileNumber: normalizedMobile });
    }

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully!",
      data: inquiry,
    });
  } catch (error) {
    console.error("createInquiry error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/inquiries  — admin ke liye saari entries
const getAllInquiries = async (req, res) => {
  try {
    if (!req.user || !["admin", "super_admin", "counsellor"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const inquiries = await Inquiry.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      data: inquiries.map(sanitizeInquiry),
      count: inquiries.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/inquiries/:id  — single inquiry by ID
const getInquiryById = async (req, res) => {
  try {
    if (!req.user || !["admin", "super_admin", "counsellor"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid inquiry ID",
      });
    }

    const inquiry = await Inquiry.findById(id).lean();

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeInquiry(inquiry),
    });
  } catch (error) {
    console.error("getInquiryById error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createInquiry, getAllInquiries, getInquiryById };
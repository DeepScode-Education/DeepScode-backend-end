const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Resend } = require("resend");

const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Payment = require("../models/Payment");
const StudentProfile = require("../models/Studentprofile");
const StudentAssignment = require("../models/Studentassignment");
const Fee = require("../models/Fee");
const { normalizeAssignment } = require("../utils/assignmentMapper");

const resend = new Resend(process.env.RESEND_API_KEY);
const SALT_ROUNDS = 10;

const getDashboard = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await Enrollment.countDocuments();
    const pendingApprovals = await User.countDocuments({
      role: "student",
      status: "pending",
    });

    const payments = await Payment.find({ paymentStatus: "success" });
    const totalRevenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalAdmins,
        totalCourses,
        totalEnrollments,
        totalRevenue,
        pendingApprovals,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// const getAllStudents = async (req, res) => {
//   try {
//     const { status } = req.query; // optional ?status=pending|approved|rejected
//     const filter = { role: "student" };
//     if (status) filter.status = status;

//     const students = await User.find(filter)
//       .select("-password")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: students.length,
//       data: students,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Server Error",
//     });
//   }
// };


const getAllStudents = async (req, res) => {
  try {
    const { status } = req.query; // optional ?status=pending|approved|rejected
    const filter = { role: "student" };
    if (status) filter.status = status;
 
    const students = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean(); // lean() so we can safely mutate plain objects below
 
    if (students.length === 0) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
 
    const studentIds = students.map((s) => s._id);
 
    // ── Parallel lookups ──────────────────────────────────────────────────────
    const [profiles, conversions] = await Promise.all([
      // (a) StudentProfile — one doc per student, may not exist yet
      StudentProfile.find({ student: { $in: studentIds } })
        .select("student mobileNumber")
        .lean(),
 
      // (b) Inquiry — find the latest "converted" lead record linked to each
      //     student. We group by convertedStudentId and take the max convertedAt.
      //     Using aggregate so a single round-trip handles all students.
      require("../models/Inquiry").aggregate([
        {
          $match: {
            convertedStudentId: { $in: studentIds },
            leadStatus: "converted",
            convertedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$convertedStudentId",
            convertedAt: { $max: "$convertedAt" },
          },
        },
      ]),
    ]);
 
    // ── Build lookup maps for O(1) merge ──────────────────────────────────────
    const profileMap = new Map(
      profiles.map((p) => [p.student.toString(), p.mobileNumber || null])
    );
 
    const conversionMap = new Map(
      conversions.map((c) => [c._id.toString(), c.convertedAt])
    );
 
    // ── Merge extra fields onto each student ──────────────────────────────────
    const enriched = students.map((s) => {
      const id = s._id.toString();
      return {
        ...s,
        // mobileNumber: profileMap.get(id) ?? null,
         mobileNumber: profileMap.get(id) ?? s.phone ?? null,
        convertedAt: conversionMap.get(id) ?? null,
      };
    });
 
    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("getAllStudents error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};





// const getStudentDetails = async (req, res) => {
//   try {
//     const student = await User.findById(req.params.id).select("-password");

//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "Student Not Found",
//       });
//     }

//     const [profile, assignment, fee, payments] = await Promise.all([
//       StudentProfile.findOne({ student: student._id }).populate(
//         "preferredCourse",
//         "title category"
//       ),
//       StudentAssignment.findOne({ student: student._id })
//         .populate("course", "title category price duration level")
//         // FIXED: mentor now lives on User collection (role: "mentor")
//         .populate("mentor", "fullName email phone designation company photoUrl expertise isActive"),
//       Fee.findOne({ student: student._id }),
//       Payment.find({ student: student._id }).sort({ paymentNumber: 1 }),
//     ]);

//     return res.status(200).json({
//       success: true,
//       student,
//       profile,
//       assignment: normalizeAssignment(assignment), // ← alias mentor.name/.specialization added
//       fee,
//       payments,
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({
//       success: false,
//       message: "Server Error",
//     });
//   }
// };


const getStudentDetails = async (req, res) => {
  try {
    const student = await User.findById(req.params.id)
      .select("-password")
      .populate("feeCollectionCounsellor", "fullName email isActive")
      .populate("assignedCounsellor", "fullName email");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student Not Found",
      });
    }

    const [profile, assignment, fee, payments] = await Promise.all([
      StudentProfile.findOne({ student: student._id }).populate(
        "preferredCourse",
        "title category"
      ),
      StudentAssignment.findOne({ student: student._id })
        .populate("course", "title category price duration level")
        .populate("mentor", "fullName email phone designation company photoUrl expertise isActive"),
      Fee.findOne({ student: student._id }),
      Payment.find({ student: student._id }).sort({ paymentNumber: 1 }),
    ]);

    return res.status(200).json({
      success: true,
      student,
      profile,
      assignment: normalizeAssignment(assignment),
      fee,
      payments,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// NEW — PATCH /api/admin/students/:id/assign-fee-collection
// Admin / Super Admin only. Independent of assignedCounsellor (lead workflow).
const assignFeeCollectionCounsellor = async (req, res) => {
  try {
    const { id } = req.params;
    const { feeCollectionCounsellorId, reason = "" } = req.body;

    const student = await User.findById(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student Not Found",
      });
    }

    let counsellor = null;

    if (feeCollectionCounsellorId) {
      // Validate the target is a real, active counsellor — never trust the ID blindly
      counsellor = await User.findOne({
        _id: feeCollectionCounsellorId,
        role: "counsellor",
        isActive: true,
      }).select("fullName email role isActive");

      if (!counsellor) {
        return res.status(400).json({
          success: false,
          message: "Selected counsellor is invalid or inactive.",
        });
      }
    }

    // Only touch feeCollectionCounsellor — assignedCounsellor (lead workflow)
    // is completely untouched, exactly like the lead-side implementation.
    student.feeCollectionCounsellor = counsellor ? counsellor._id : null;
    await student.save();

    const updated = await User.findById(id)
      .select("-password")
      .populate("feeCollectionCounsellor", "fullName email isActive")
      .populate("assignedCounsellor", "fullName email");

    return res.status(200).json({
      success: true,
      message: counsellor
        ? `Fee collection counsellor assigned: ${counsellor.fullName}`
        : "Fee collection counsellor unassigned",
      data: updated,
    });
  } catch (error) {
    console.error("assignFeeCollectionCounsellor error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// ── Generate a unique 4-digit Student ID ──
const generateUniqueStudentId = async () => {
  let studentId;
  let exists = true;

  while (exists) {
    studentId = String(Math.floor(1000 + Math.random() * 9000)); // 1000–9999
    exists = await User.findOne({ studentId });
  }

  return studentId;
};

// ── Generate a readable random password for admin-created student accounts ──
const generateRandomPassword = (length = 10) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[crypto.randomInt(0, chars.length)];
  }
  return pwd;
};

// GET /api/admin/students/pending
const getPendingStudents = async (req, res) => {
  try {
    const pending = await User.find({
      role: "student",
      status: "pending",
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: pending.length,
      data: pending,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// POST /api/admin/students
// Admin creates a student account directly — no self-registration/email-OTP
// flow required. Auto-generates a unique 4-digit Student ID, sets
// role="student" + status="approved" immediately, hashes a generated (or
// admin-supplied) password, and optionally emails the login credentials.
const addStudent = async (req, res) => {
  try {
    const { fullName, email, password, sendEmail = true, branch } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required",
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "A valid email is required",
      });
    }

    if (password && password.trim().length > 0 && password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Use admin-supplied password if valid, otherwise auto-generate one.
    const plainPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : generateRandomPassword();

    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    const studentId = await generateUniqueStudentId();

    const student = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "student",
      status: "approved", // skips the pending-approval workflow entirely
      studentId,
      isActive: true,
      branch: branch || null,
      approvedAt: new Date(),
      createdBy: req.user.id,
    });

    let emailSent = false;
    let emailError = null;

    if (sendEmail) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: normalizedEmail,
          subject: "Your deepScode Student Account",
          html: `
            <div style="font-family:sans-serif">
              <h2>Welcome to deepScode, ${student.fullName}!</h2>
              <p>Your student account has been created by an administrator. Use the credentials below to log in:</p>
              <p><strong>Student ID:</strong> ${studentId}</p>
              <p><strong>Password:</strong> ${plainPassword}</p>
              <p>Please log in and change your password after your first login.</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error("[addStudent] email send failed:", mailErr.message);
        emailError = mailErr.message;
      }
    }

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: {
        id: student._id,
        fullName: student.fullName,
        email: student.email,
        studentId: student.studentId,
        status: student.status,
        role: student.role,
      },
      // Returned once so the admin can copy/share manually if sendEmail
      // was false or the email failed — never persisted or logged elsewhere.
      credentials: {
        studentId,
        password: plainPassword,
      },
      emailSent,
      emailError,
    });
  } catch (error) {
    console.error("[addStudent] error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate account detected.",
      });
    }
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((e) => e.message)
        .join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// PATCH /api/admin/students/:id/approve
const approveStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student Not Found",
      });
    }

    if (student.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Student is already approved",
        studentId: student.studentId,
      });
    }

    const studentId = await generateUniqueStudentId();

    student.status = "approved";
    student.studentId = studentId;
    student.approvedAt = new Date();
    await student.save();

    return res.status(200).json({
      success: true,
      message: "Student approved successfully",
      data: {
        id: student._id,
        fullName: student.fullName,
        email: student.email,
        studentId: student.studentId,
        status: student.status,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// PATCH /api/admin/students/:id/reject
const rejectStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student Not Found",
      });
    }

    student.status = "rejected";
    await student.save();

    return res.status(200).json({
      success: true,
      message: "Student rejected",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findById(id);

    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student Not Found" });
    }

    // Delete related data
    await Promise.all([
      StudentProfile.findOneAndDelete({ student: id }),
      StudentAssignment.findOneAndDelete({ student: id }),
      Fee.findOneAndDelete({ student: id }),
      Payment.deleteMany({ student: id }),
    ]);

    await User.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: "Student deleted successfully" });
  } catch (error) {
    console.error("deleteStudent error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// PUT /api/admin/students/:id/profile
const updateStudentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName, mobileNumber, dob, fatherName,
      address, city, state, pincode,
      govtIdType, govtIdNumber,
    } = req.body;

    const student = await User.findById(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student Not Found" });
    }

    // Update fullName on User model too
    if (fullName) {
      student.fullName = fullName.trim();
      await student.save();
    }

    // Upsert StudentProfile
    const profileData = {};
    if (fullName)      profileData.fullName     = fullName.trim();
    if (mobileNumber)  profileData.mobileNumber  = mobileNumber.trim();
    if (dob)           profileData.dob           = dob;
    if (fatherName)    profileData.fatherName     = fatherName.trim();
    if (address)       profileData.address        = address.trim();
    if (city)          profileData.city           = city.trim();
    if (state)         profileData.state          = state.trim();
    if (pincode)       profileData.pincode        = pincode.trim();
    if (govtIdType)    profileData.govtIdType     = govtIdType;
    if (govtIdNumber)  profileData.govtIdNumber   = govtIdNumber.trim();

    const profile = await StudentProfile.findOneAndUpdate(
      { student: id },
      { $set: { student: id, ...profileData } },
      { new: true, upsert: true, runValidators: false }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: profile,
    });
  } catch (error) {
    console.error("updateStudentProfile error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
module.exports = {
  getDashboard,
  getAllStudents,
  getStudentDetails,
  getPendingStudents,
  approveStudent,
  rejectStudent,
  addStudent, 
   deleteStudent,        
  updateStudentProfile, 
  assignFeeCollectionCounsellor,
};
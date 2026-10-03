
// const bcrypt = require("bcryptjs");
// const User   = require("../models/User");

// const SALT_ROUNDS = 10;
// const { STAFF_ROLES } = User; // ["admin", "counsellor", "mentor", "accountant"]

// // ─── Permission matrix ────────────────────────────────────────────────────────
// const canManageRole = (requesterRole, targetRole) => {
//   if (requesterRole === "super_admin") return STAFF_ROLES.includes(targetRole);
//   if (requesterRole === "admin")       return ["counsellor", "mentor", "accountant"].includes(targetRole);
//   return false;
// };

// const visibleRolesFor = (requesterRole) =>
//   requesterRole === "super_admin" ? STAFF_ROLES : ["counsellor", "mentor", "accountant"];

// // ─── POST /api/staff ──────────────────────────────────────────────────────────
// const createStaff = async (req, res) => {
//   try {
//     const { fullName, email, password, role, phone, branch } = req.body;

//     if (!fullName || !email || !password || !role) {
//       return res.status(400).json({
//         success: false,
//         message: "fullName, email, password and role are required.",
//       });
//     }

//     if (!canManageRole(req.user.role, role)) {
//       return res.status(403).json({
//         success: false,
//         message:
//           req.user.role === "admin"
//             ? "Admins cannot create Super Admin or Admin accounts."
//             : "You are not allowed to create this role.",
//       });
//     }

//     if (password.length < 8) {
//       return res.status(400).json({
//         success: false,
//         message: "Password must be at least 8 characters.",
//       });
//     }

//     const normalizedEmail = email.toLowerCase().trim();
//     const existing = await User.findOne({ email: normalizedEmail });
//     if (existing) {
//       return res.status(409).json({
//         success: false,
//         message: "An account with this email already exists.",
//       });
//     }

//     const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

//     const staff = await User.create({
//       fullName:  fullName.trim(),
//       email:     normalizedEmail,
//       password:  hashedPassword,
//       role,
//       phone:     phone    || undefined,
//       branch:    branch   || null,
//       createdBy: req.user.id,
//     });

//     return res.status(201).json({
//       success: true,
//       message: `${role} account created successfully.`,
//       data: staff.toSafeJSON(),
//     });
//   } catch (error) {
//     console.error("[createStaff] error:", error);
//     if (error.code === 11000) {
//       return res.status(409).json({ success: false, message: "Email already in use." });
//     }
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors).map((e) => e.message).join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── GET /api/staff ───────────────────────────────────────────────────────────
// const getAllStaff = async (req, res) => {
//   try {
//     const { role, branch, isActive, search, page = 1, limit = 20 } = req.query;

//     const allowedRoles = visibleRolesFor(req.user.role);
//     const filter = { role: { $in: allowedRoles } };

//     if (role) {
//       if (!allowedRoles.includes(role)) {
//         return res.status(403).json({ success: false, message: "Not allowed to view this role." });
//       }
//       filter.role = role;
//     }

//     if (branch)             filter.branch   = branch;
//     if (isActive !== undefined) filter.isActive = isActive === "true";
//     if (search?.trim()) {
//       filter.$or = [
//         { fullName: { $regex: search.trim(), $options: "i" } },
//         { email:    { $regex: search.trim(), $options: "i" } },
//       ];
//     }

//     const pageNum  = Math.max(1, parseInt(page,  10) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
//     const skip     = (pageNum - 1) * limitNum;

//     const [staff, total] = await Promise.all([
//       User.find(filter)
//         .select("-password")
//         .populate("branch", "name code")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limitNum),
//       User.countDocuments(filter),
//     ]);

//     return res.status(200).json({
//       success: true,
//       count: staff.length,
//       total,
//       page:       pageNum,
//       totalPages: Math.ceil(total / limitNum),
//       data:       staff,
//     });
//   } catch (error) {
//     console.error("[getAllStaff] error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── GET /api/staff/:id ───────────────────────────────────────────────────────
// const getStaffById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } })
//       .select("-password")
//       .populate("branch", "name code");

//     if (!staff) {
//       return res.status(404).json({ success: false, message: "Staff member not found." });
//     }

//     if (!visibleRolesFor(req.user.role).includes(staff.role)) {
//       return res.status(403).json({ success: false, message: "Not allowed to view this account." });
//     }

//     return res.status(200).json({ success: true, data: staff });
//   } catch (error) {
//     console.error("[getStaffById] error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── PUT /api/staff/:id ───────────────────────────────────────────────────────
// // v2: email change is now supported with duplicate check.
// const updateStaff = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { fullName, email, phone, branch, role } = req.body;

//     const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
//     if (!staff) {
//       return res.status(404).json({ success: false, message: "Staff member not found." });
//     }

//     if (!canManageRole(req.user.role, staff.role)) {
//       return res.status(403).json({ success: false, message: "Not allowed to modify this account." });
//     }

//     // ── Role change: validate new role too ─────────────────────────────────
//     if (role && role !== staff.role) {
//       if (!canManageRole(req.user.role, role)) {
//         return res.status(403).json({ success: false, message: "Not allowed to assign this role." });
//       }
//       staff.role = role;
//     }

//     // ── Email change: check for duplicates ─────────────────────────────────
//     if (email && email.toLowerCase().trim() !== staff.email) {
//       const normalizedEmail = email.toLowerCase().trim();

//       // Basic format validation
//       if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
//         return res.status(400).json({ success: false, message: "Invalid email format." });
//       }

//       const emailTaken = await User.findOne({
//         email: normalizedEmail,
//         _id:   { $ne: id }, // exclude self
//       });
//       if (emailTaken) {
//         return res.status(409).json({
//           success: false,
//           message: "This email is already in use by another account.",
//         });
//       }

//       staff.email = normalizedEmail;
//     }

//     if (fullName)          staff.fullName = fullName.trim();
//     if (phone !== undefined) staff.phone  = phone || undefined;
//     if (branch !== undefined) staff.branch = branch || null;

//     await staff.save();

//     return res.status(200).json({
//       success: true,
//       message: "Staff account updated successfully.",
//       data:    staff.toSafeJSON(),
//     });
//   } catch (error) {
//     console.error("[updateStaff] error:", error);
//     if (error.code === 11000) {
//       return res.status(409).json({ success: false, message: "Email already in use." });
//     }
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors).map((e) => e.message).join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── PATCH /api/staff/:id/deactivate & /activate ─────────────────────────────
// const setStaffActiveStatus = async (req, res, isActive) => {
//   try {
//     const { id } = req.params;

//     const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
//     if (!staff) {
//       return res.status(404).json({ success: false, message: "Staff member not found." });
//     }

//     if (!canManageRole(req.user.role, staff.role)) {
//       return res.status(403).json({ success: false, message: "Not allowed to modify this account." });
//     }

//     if (String(staff._id) === String(req.user.id)) {
//       return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
//     }

//     staff.isActive = isActive;
//     await staff.save();

//     return res.status(200).json({
//       success: true,
//       message: isActive ? "Staff account activated." : "Staff account deactivated.",
//       data:    staff.toSafeJSON(),
//     });
//   } catch (error) {
//     console.error("[setStaffActiveStatus] error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// const deactivateStaff = (req, res) => setStaffActiveStatus(req, res, false);
// const activateStaff   = (req, res) => setStaffActiveStatus(req, res, true);

// // ─── PATCH /api/staff/:id/reset-password ─────────────────────────────────────
// const resetStaffPassword = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { newPassword } = req.body;

//     if (!newPassword || newPassword.length < 8) {
//       return res.status(400).json({
//         success: false,
//         message: "newPassword is required and must be at least 8 characters.",
//       });
//     }

//     const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
//     if (!staff) {
//       return res.status(404).json({ success: false, message: "Staff member not found." });
//     }

//     if (!canManageRole(req.user.role, staff.role)) {
//       return res.status(403).json({ success: false, message: "Not allowed to modify this account." });
//     }

//     staff.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
//     await staff.save();

//     return res.status(200).json({ success: true, message: "Password reset successfully." });
//   } catch (error) {
//     console.error("[resetStaffPassword] error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// // ─── DELETE /api/staff/:id ────────────────────────────────────────────────────
// // Hard delete — permanently removes the staff account from the database.
// //
// // Safety checks:
// //   1. Only super_admin can hard delete (admin can only deactivate).
// //   2. Cannot delete yourself.
// //   3. Staff must exist and must actually be a staff role (not a student).
// //
// // NOTE: Related data (leads assigned, payments recorded, etc.) will have
// //       dangling references after hard delete. Consider deactivate instead
// //       unless you are sure the account has no history.
// const deleteStaff = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // Only super_admin can hard-delete
//     if (req.user.role !== "super_admin") {
//       return res.status(403).json({
//         success: false,
//         message: "Only Super Admins can permanently delete staff accounts. Use deactivate instead.",
//       });
//     }

//     const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
//     if (!staff) {
//       return res.status(404).json({ success: false, message: "Staff member not found." });
//     }

//     // Cannot delete yourself
//     if (String(staff._id) === String(req.user.id)) {
//       return res.status(400).json({
//         success: false,
//         message: "You cannot delete your own account.",
//       });
//     }

//     await User.findByIdAndDelete(id);

//     return res.status(200).json({
//       success: true,
//       message: `Staff account for "${staff.fullName}" has been permanently deleted.`,
//       deletedId: id,
//     });
//   } catch (error) {
//     console.error("[deleteStaff] error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

// module.exports = {
//   createStaff,
//   getAllStaff,
//   getStaffById,
//   updateStaff,
//   deactivateStaff,
//   activateStaff,
//   resetStaffPassword,
//   deleteStaff, // ← NEW
// };




const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User   = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const StaffAttendance = require("../models/StaffAttendance");
const StaffLeave = require("../models/StaffLeave");
const StaffDocument = require("../models/StaffDocument");
const ActivityLog = require("../models/ActivityLog");
const {
  ROLE_DEFAULT_PERMISSIONS,
} = require("../config/permissions");
const { getEffectivePermissions } = require("../middleware/permission.middleware");

const SALT_ROUNDS = 10;
const { STAFF_ROLES } = User; // all creatable staff roles; super_admin is the fixed Institute Owner role

// ─── Permission matrix ────────────────────────────────────────────────────────
const canManageRole = (requesterRole, targetRole) => {
  if (requesterRole === "super_admin") return STAFF_ROLES.includes(targetRole);
  if (requesterRole === "admin" || requesterRole === "hr") {
    return ["counsellor", "mentor", "accountant", "coordinator", "hr", "receptionist"].includes(targetRole);
  }
  return false;
};

const visibleRolesFor = (requesterRole) =>
  requesterRole === "super_admin"
    ? STAFF_ROLES
    : ["counsellor", "mentor", "accountant", "coordinator", "hr", "receptionist"];

const getStaffDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }

    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } })
      .select("fullName email phone role branch isActive status profileCompleted createdAt lastLoginAt permissionOverrides")
      .populate("branch", "name code")
      .lean();

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    if (!visibleRolesFor(req.user.role).includes(staff.role)) {
      return res.status(403).json({ success: false, message: "Not allowed to view this account." });
    }

    const overrides = staff.permissionOverrides || [];
    delete staff.permissionOverrides;

    const [profile, attendance, leaves, documents, effectivePermissions, activity] = await Promise.all([
      StaffProfile.findOne({ user: id }).lean(),
      StaffAttendance.find({ staff: id }).sort({ date: -1 }).limit(10).lean(),
      StaffLeave.find({ staff: id }).sort({ createdAt: -1 }).limit(10)
        .populate("reviewedBy", "fullName role").lean(),
      StaffDocument.find({ staff: id }).sort({ createdAt: -1 }).limit(50)
        .populate("uploadedBy", "fullName role").lean(),
      getEffectivePermissions(staff._id, staff.role),
      ActivityLog.find({ resource: "User", resourceId: String(id) })
        .sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    const attendanceSummary = attendance.reduce((summary, record) => {
      summary.totalMarked += 1;
      if (record.status === "half_day") summary.halfDay += 1;
      else if (Object.prototype.hasOwnProperty.call(summary, record.status)) summary[record.status] += 1;
      return summary;
    }, { totalMarked: 0, present: 0, absent: 0, leave: 0, halfDay: 0, holiday: 0 });

    return res.status(200).json({
      success: true,
      data: {
        staff,
        profile: profile || null,
        attendance: { summary: attendanceSummary, records: attendance },
        leaves,
        documents,
        permissions: {
          roleDefaults: ROLE_DEFAULT_PERMISSIONS[staff.role] || [],
          overrides,
          effectivePermissions: [...effectivePermissions],
        },
        activity,
      },
    });
  } catch (error) {
    console.error("[getStaffDetails] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

const getStaffActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }

    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } })
      .select("fullName email role")
      .lean();
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }
    if (!visibleRolesFor(req.user.role).includes(staff.role)) {
      return res.status(403).json({ success: false, message: "Not allowed to view this activity." });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = { resource: "User", resourceId: String(id) };

    if (req.query.action?.trim()) query.action = req.query.action.trim();
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (Number.isNaN(from.getTime())) return res.status(400).json({ success: false, message: "Invalid from date." });
        query.createdAt.$gte = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        if (Number.isNaN(to.getTime())) return res.status(400).json({ success: false, message: "Invalid to date." });
        query.createdAt.$lte = to;
      }
    }

    const [activity, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: { staff, activity, page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[getStaffActivity] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── POST /api/staff ──────────────────────────────────────────────────────────
const createStaff = async (req, res) => {
  try {
    const { fullName, email, password, role, phone, branch } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "fullName, email, password and role are required.",
      });
    }

    if (!canManageRole(req.user.role, role)) {
      return res.status(403).json({
        success: false,
        message:
          req.user.role === "admin"
            ? "Admins cannot create Super Admin or Admin accounts."
            : "You are not allowed to create this role.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
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

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const staff = await User.create({
      fullName:  fullName.trim(),
      email:     normalizedEmail,
      password:  hashedPassword,
      role,
      phone:     phone    || undefined,
      branch:    branch   || null,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: `${role} account created successfully.`,
      data: staff.toSafeJSON(),
    });
  } catch (error) {
    console.error("[createStaff] error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── GET /api/staff ───────────────────────────────────────────────────────────
const getAllStaff = async (req, res) => {
  try {
    const { role, branch, isActive, search, page = 1, limit = 20 } = req.query;

    const allowedRoles = visibleRolesFor(req.user.role);
    const filter = { role: { $in: allowedRoles } };

    if (role) {
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: "Not allowed to view this role." });
      }
      filter.role = role;
    }

    if (branch)             filter.branch   = branch;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search?.trim()) {
      filter.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
        { email:    { $regex: search.trim(), $options: "i" } },
      ];
    }

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    const [staff, total] = await Promise.all([
      User.find(filter)
        .select("fullName email phone role branch isActive status profileCompleted createdAt lastLoginAt")
        .populate("branch", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: staff.length,
      total,
      page:       pageNum,
      totalPages: Math.ceil(total / limitNum),
      data:       staff,
    });
  } catch (error) {
    console.error("[getAllStaff] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── GET /api/staff/:id ───────────────────────────────────────────────────────
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }
    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } })
      .select("fullName email phone role branch isActive status profileCompleted createdAt lastLoginAt")
      .populate("branch", "name code");

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    if (!visibleRolesFor(req.user.role).includes(staff.role)) {
      return res.status(403).json({ success: false, message: "Not allowed to view this account." });
    }

    return res.status(200).json({ success: true, data: staff });
  } catch (error) {
    console.error("[getStaffById] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── PUT /api/staff/:id ───────────────────────────────────────────────────────
// v2: email change is now supported with duplicate check.
const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }
    const { fullName, email, phone, branch, role } = req.body;

    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    if (!canManageRole(req.user.role, staff.role)) {
      return res.status(403).json({ success: false, message: "Not allowed to modify this account." });
    }

    // ── Role change: validate new role too ─────────────────────────────────
    if (role && role !== staff.role) {
      if (!canManageRole(req.user.role, role)) {
        return res.status(403).json({ success: false, message: "Not allowed to assign this role." });
      }
      staff.role = role;
    }

    // ── Email change: check for duplicates ─────────────────────────────────
    if (email && email.toLowerCase().trim() !== staff.email) {
      const normalizedEmail = email.toLowerCase().trim();

      // Basic format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
      }

      const emailTaken = await User.findOne({
        email: normalizedEmail,
        _id:   { $ne: id }, // exclude self
      });
      if (emailTaken) {
        return res.status(409).json({
          success: false,
          message: "This email is already in use by another account.",
        });
      }

      staff.email = normalizedEmail;
    }

    if (fullName)          staff.fullName = fullName.trim();
    if (phone !== undefined) staff.phone  = phone || undefined;
    if (branch !== undefined) staff.branch = branch || null;

    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff account updated successfully.",
      data:    staff.toSafeJSON(),
    });
  } catch (error) {
    console.error("[updateStaff] error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── PATCH /api/staff/:id/deactivate & /activate ─────────────────────────────
const setStaffActiveStatus = async (req, res, isActive) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }

    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    if (!canManageRole(req.user.role, staff.role)) {
      return res.status(403).json({ success: false, message: "Not allowed to modify this account." });
    }

    if (String(staff._id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
    }

    staff.isActive = isActive;
    await staff.save();

    return res.status(200).json({
      success: true,
      message: isActive ? "Staff account activated." : "Staff account deactivated.",
      data:    staff.toSafeJSON(),
    });
  } catch (error) {
    console.error("[setStaffActiveStatus] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

const deactivateStaff = (req, res) => setStaffActiveStatus(req, res, false);
const activateStaff   = (req, res) => setStaffActiveStatus(req, res, true);

// ─── PATCH /api/staff/:id/reset-password ─────────────────────────────────────
const resetStaffPassword = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "newPassword is required and must be at least 8 characters.",
      });
    }

    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    if (!canManageRole(req.user.role, staff.role)) {
      return res.status(403).json({ success: false, message: "Not allowed to modify this account." });
    }

    staff.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await staff.save();

    return res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("[resetStaffPassword] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── DELETE /api/staff/:id ────────────────────────────────────────────────────
// Hard delete — permanently removes the staff account from the database.
//
// Safety checks:
//   1. Only super_admin can hard delete (admin can only deactivate).
//   2. Cannot delete yourself.
//   3. Staff must exist and must actually be a staff role (not a student).
//
// NOTE: Related data (leads assigned, payments recorded, etc.) will have
//       dangling references after hard delete. Consider deactivate instead
//       unless you are sure the account has no history.
const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID." });
    }

    // Only super_admin can hard-delete
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admins can permanently delete staff accounts. Use deactivate instead.",
      });
    }

    const staff = await User.findOne({ _id: id, role: { $in: STAFF_ROLES } });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    // Cannot delete yourself
    if (String(staff._id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account.",
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Staff account for "${staff.fullName}" has been permanently deleted.`,
      deletedId: id,
    });
  } catch (error) {
    console.error("[deleteStaff] error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deactivateStaff,
  activateStaff,
  resetStaffPassword,
  deleteStaff, // ← NEW
  getStaffDetails,
  getStaffActivity,
};


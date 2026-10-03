// controllers/permission.controller.js

const User = require("../models/User");
const mongoose = require("mongoose");

const { STAFF_ROLES } = User;

const {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_DEFAULT_PERMISSIONS,
} = require("../config/permissions");

const {
  getEffectivePermissions,
} = require("../middleware/permission.middleware");

// Permission management is intentionally Super Admin only.
// Staff roles may use the permissions they have, but they cannot grant
// permissions to other staff through these APIs.
const canManagePermissionTarget = (requesterRole, targetRole) => {
  return (
    requesterRole === "super_admin" &&
    STAFF_ROLES.includes(targetRole) &&
    targetRole !== "super_admin"
  );
};

const getMyPermissions = async (req, res) => {
  try {
    const permissions = await getEffectivePermissions(
      req.user.id,
      req.user.role
    );

    return res.status(200).json({
      success: true,
      data: {
        role: req.user.role,
        permissions: [...permissions],
      },
    });
  } catch (error) {
    console.error("[getMyPermissions] error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load permissions.",
    });
  }
};

const getPermissionCatalog = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Only Super Admin needs the complete catalog for the permission
    // management screen.
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can access the permission catalog.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        allPermissions: ALL_PERMISSIONS,
        groups: PERMISSION_GROUPS,
        roleDefaults: ROLE_DEFAULT_PERMISSIONS,
      },
    });
  } catch (error) {
    console.error("[getPermissionCatalog] error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load permission catalog.",
    });
  }
};

const getStaffPermissions = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can manage staff permissions.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID.",
      });
    }

    const staff = await User.findOne({
      _id: req.params.id,
      role: { $in: STAFF_ROLES },
    })
      .select(
        "fullName email phone role permissionOverrides isActive status branch profileCompleted"
      )
      .populate("branch", "name code")
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found.",
      });
    }

    if (!canManagePermissionTarget(req.user.role, staff.role)) {
      return res.status(403).json({
        success: false,
        message: "This staff account cannot be managed here.",
      });
    }

    if (String(staff._id) === String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot modify your own permissions.",
      });
    }

    const effectivePermissions = await getEffectivePermissions(
      staff._id,
      staff.role
    );

    return res.status(200).json({
      success: true,
      data: {
        staff,
        allPermissions: ALL_PERMISSIONS,
        groups: PERMISSION_GROUPS,
        roleDefaults: ROLE_DEFAULT_PERMISSIONS[staff.role] || [],
        overrides: staff.permissionOverrides || [],
        effectivePermissions: [...effectivePermissions],
      },
    });
  } catch (error) {
    console.error("[getStaffPermissions] error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load staff permissions.",
    });
  }
};

const updateStaffPermissions = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can update staff permissions.",
      });
    }

    const { id } = req.params;
    const { overrides = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID.",
      });
    }

    if (!Array.isArray(overrides)) {
      return res.status(400).json({
        success: false,
        message: "overrides must be an array.",
      });
    }

    const staff = await User.findOne({
      _id: id,
      role: { $in: STAFF_ROLES },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found.",
      });
    }

    if (staff.role === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Super Admin permissions cannot be edited.",
      });
    }

    if (
      !canManagePermissionTarget(req.user.role, staff.role) ||
      String(staff._id) === String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to modify this staff member's permissions.",
      });
    }

    const validPermissions = new Set(ALL_PERMISSIONS);
    const cleaned = [];
    const seen = new Set();

    for (const item of overrides) {
      if (!item || typeof item.permission !== "string") {
        return res.status(400).json({
          success: false,
          message: "Each override must contain a permission string.",
        });
      }

      const permission = item.permission.trim();

      if (!validPermissions.has(permission)) {
        return res.status(400).json({
          success: false,
          message: `Invalid permission: ${permission}`,
        });
      }

      if (typeof item.allowed !== "boolean") {
        return res.status(400).json({
          success: false,
          message: `allowed must be boolean for ${permission}.`,
        });
      }

      if (seen.has(permission)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate permission override: ${permission}`,
        });
      }

      seen.add(permission);

      cleaned.push({
        permission,
        allowed: item.allowed,
      });
    }

    staff.permissionOverrides = cleaned;
    await staff.save();

    const effectivePermissions = await getEffectivePermissions(
      staff._id,
      staff.role
    );

    return res.status(200).json({
      success: true,
      message: "Staff permissions updated successfully.",
      data: {
        staffId: staff._id,
        role: staff.role,
        overrides: staff.permissionOverrides,
        effectivePermissions: [...effectivePermissions],
      },
    });
  } catch (error) {
    console.error("[updateStaffPermissions] error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update staff permissions.",
    });
  }
};

module.exports = {
  getMyPermissions,
  getPermissionCatalog,
  getStaffPermissions,
  updateStaffPermissions,
};

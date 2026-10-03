// middleware/permission.middleware.js

const User = require("../models/User");
const {
  ROLE_DEFAULT_PERMISSIONS,
  ALL_PERMISSIONS,
} = require("../config/permissions");

const ALL_PERMISSION_SET = new Set(ALL_PERMISSIONS);

const getEffectivePermissions = async (userId, role) => {
  // Super Admin always has the complete permission registry.
  if (role === "super_admin") {
    return new Set(ALL_PERMISSIONS);
  }

  const permissions = new Set(ROLE_DEFAULT_PERMISSIONS[role] || []);

  const user = await User.findById(userId)
    .select("permissionOverrides")
    .lean();

  for (const override of user?.permissionOverrides || []) {
    if (!override?.permission) continue;

    // Never allow an unknown permission to become effective, even if an old
    // database record contains a typo or a permission removed in the future.
    if (!ALL_PERMISSION_SET.has(override.permission)) continue;

    // Students are intentionally isolated from staff-management permissions.
    if (
      role === "student" &&
      /^(employees|attendance|leave|documents|payroll)\./.test(
        override.permission
      )
    ) {
      continue;
    }

    if (override.allowed === true) {
      permissions.add(override.permission);
    } else if (override.allowed === false) {
      permissions.delete(override.permission);
    }
  }

  return permissions;
};

const requirePermission = (permission) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!ALL_PERMISSION_SET.has(permission)) {
      console.error(`[requirePermission] Unknown permission: ${permission}`);

      return res.status(500).json({
        success: false,
        message: "Invalid server permission configuration.",
      });
    }

    if (req.user.role === "super_admin") {
      req.permissions = new Set(ALL_PERMISSIONS);
      return next();
    }

    const permissions = await getEffectivePermissions(
      req.user.id,
      req.user.role
    );

    if (!permissions.has(permission)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
        permission,
      });
    }

    req.permissions = permissions;
    return next();
  } catch (error) {
    console.error("[requirePermission] error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify permissions.",
    });
  }
};

const requireAnyPermission = (...permissions) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const invalidPermission = permissions.find(
      (permission) => !ALL_PERMISSION_SET.has(permission)
    );

    if (invalidPermission) {
      console.error(
        `[requireAnyPermission] Unknown permission: ${invalidPermission}`
      );

      return res.status(500).json({
        success: false,
        message: "Invalid server permission configuration.",
      });
    }

    if (req.user.role === "super_admin") {
      req.permissions = new Set(ALL_PERMISSIONS);
      return next();
    }

    const effective = await getEffectivePermissions(
      req.user.id,
      req.user.role
    );

    const allowed = permissions.some((permission) =>
      effective.has(permission)
    );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have any of the required permissions.",
        permissions,
      });
    }

    req.permissions = effective;
    return next();
  } catch (error) {
    console.error("[requireAnyPermission] error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify permissions.",
    });
  }
};

module.exports = {
  getEffectivePermissions,
  requirePermission,
  requireAnyPermission,
};

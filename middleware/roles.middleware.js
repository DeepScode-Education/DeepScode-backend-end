// middleware/roles.middleware.js
//
// Generic role-gate middleware. Mount AFTER the `auth` middleware (which sets
// req.user from the JWT). Used by lead.routes.js to enforce the updated
// counsellor permission model:
//   - isCounsellor   → counsellor, admin, super_admin (existing pattern, kept)
//   - isAdminOrSuper → admin, super_admin only (assign, delete, approve/reject)
//   - isSuperAdmin   → super_admin only

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action",
    });
  }
  next();
};

const isCounsellor   = allowRoles("counsellor", "admin", "super_admin");
const isAdminOrSuper = allowRoles("admin", "super_admin");
const isSuperAdmin   = allowRoles("super_admin");

module.exports = { allowRoles, isCounsellor, isAdminOrSuper, isSuperAdmin };

// const jwt = require("jsonwebtoken");



// const optionalAuth = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (authHeader && authHeader.startsWith("Bearer ")) {
//       const token = authHeader.split(" ")[1];
//       req.user = jwt.verify(token, process.env.JWT_SECRET);
//     }
//   } catch (_) {
//     // invalid/expired token yahan 401 nahi dega — anonymous treat hoga
//   }
//   next();
// };
// // ─── auth ──────────────────────────────────────────────────────────────────────
// // Verifies the Bearer token and attaches decoded payload to req.user.
// // Unchanged logic from your original — just tidied up.
// // const auth = (req, res, next) => {
// //   try {
// //     const authHeader = req.headers.authorization;

// //     if (!authHeader || !authHeader.startsWith("Bearer ")) {
// //       return res.status(401).json({
// //         success: false,
// //         message: "No token provided. Please log in.",
// //       });
// //     }

// //     const token = authHeader.split(" ")[1];

// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);

// //     // decoded = { id, role, branch, iat, exp }
// //     req.user = decoded;

// //     next();
// //   } catch (error) {
// //     // Distinguish between expired and invalid tokens for better client UX
// //     const message =
// //       error.name === "TokenExpiredError"
// //         ? "Session expired. Please log in again."
// //         : "Invalid token. Please log in.";

// //     return res.status(401).json({ success: false, message });
// //   }
// // };

// const auth = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     let token = null;

//     if (authHeader && authHeader.startsWith("Bearer ")) {
//       token = authHeader.split(" ")[1];
//     } else if (req.query && typeof req.query.token === "string" && req.query.token) {
//       // Fallback for contexts that can't send an Authorization header,
//       // e.g. a native <video src="..."> request hitting the stream route.
//       token = req.query.token;
//     }

//     if (!token) {
//       return res.status(401).json({ success: false, message: "No token provided. Please log in." });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (error) {
//     const message =
//       error.name === "TokenExpiredError"
//         ? "Session expired. Please log in again."
//         : "Invalid token. Please log in.";
//     return res.status(401).json({ success: false, message });
//   }
// };

// // ─── requireRoles ──────────────────────────────────────────────────────────────
// // Factory that returns a middleware allowing only the specified roles.
// // Replaces the old admin.middleware.js — use this everywhere instead.
// //
// // Usage examples:
// //   router.get("/dashboard", auth, requireRoles("admin", "super_admin"), handler)
// //   router.get("/my-leads",  auth, requireRoles("counsellor"), handler)
// //   router.get("/profile",   auth, requireRoles("student"), handler)
// //
// const requireRoles = (...roles) => (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({ success: false, message: "Unauthorized" });
//   }

//   if (!roles.includes(req.user.role)) {
//     return res.status(403).json({
//       success: false,
//       message: `Access denied. Required role: ${roles.join(" or ")}.`,
//     });
//   }

//   next();
// };

// // ─── Convenience shorthands ────────────────────────────────────────────────────
// // These keep existing route files working with minimal changes.
// // Old: auth, admin   →   New: auth, isAdmin
// const isAdmin      = requireRoles("admin", "super_admin");
// const isSuperAdmin = requireRoles("super_admin");
// const isCounsellor = requireRoles("counsellor", "admin", "super_admin");
// const isMentor     = requireRoles("mentor", "admin", "super_admin");
// const isAccountant = requireRoles("accountant", "admin", "super_admin");
// const isStudent    = requireRoles("student");
// const isStaff      = requireRoles("super_admin", "admin", "counsellor", "mentor", "accountant");

// module.exports = {
//   auth,
//   requireRoles,
//   // shorthands
//   isAdmin,
//   isSuperAdmin,
//   isCounsellor,
//   isMentor,
//   isAccountant,
//   isStudent,
//   isStaff,
//   optionalAuth, 
// };








const jwt = require("jsonwebtoken");



const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    }
  } catch (_) {
    // invalid/expired token yahan 401 nahi dega — anonymous treat hoga
  }
  next();
};
// ─── auth ──────────────────────────────────────────────────────────────────────
// Verifies the Bearer token and attaches decoded payload to req.user.
// Unchanged logic from your original — just tidied up.
// const auth = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "No token provided. Please log in.",
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // decoded = { id, role, branch, iat, exp }
//     req.user = decoded;

//     next();
//   } catch (error) {
//     // Distinguish between expired and invalid tokens for better client UX
//     const message =
//       error.name === "TokenExpiredError"
//         ? "Session expired. Please log in again."
//         : "Invalid token. Please log in.";

//     return res.status(401).json({ success: false, message });
//   }
// };

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query && typeof req.query.token === "string" && req.query.token) {
      // Fallback for contexts that can't send an Authorization header,
      // e.g. a native <video src="..."> request hitting the stream route.
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided. Please log in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid token. Please log in.";
    return res.status(401).json({ success: false, message });
  }
};

// ─── requireRoles ──────────────────────────────────────────────────────────────
// Factory that returns a middleware allowing only the specified roles.
// Replaces the old admin.middleware.js — use this everywhere instead.
//
// Usage examples:
//   router.get("/dashboard", auth, requireRoles("admin", "super_admin"), handler)
//   router.get("/my-leads",  auth, requireRoles("counsellor"), handler)
//   router.get("/profile",   auth, requireRoles("student"), handler)
//
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(" or ")}.`,
    });
  }

  next();
};

// ─── Convenience shorthands ────────────────────────────────────────────────────
// These keep existing route files working with minimal changes.
// Old: auth, admin   →   New: auth, isAdmin
const isAdmin      = requireRoles("admin", "super_admin");
const isSuperAdmin = requireRoles("super_admin");
const isCounsellor = requireRoles("counsellor", "admin", "super_admin");
const isMentor     = requireRoles("mentor", "admin", "super_admin");
const isAccountant  = requireRoles("accountant", "admin", "super_admin");
const isCoordinator = requireRoles("coordinator");
const isHR          = requireRoles("hr");
const isReceptionist = requireRoles("receptionist");
const isStudent     = requireRoles("student");
const isStaff       = requireRoles("super_admin", "admin", "counsellor", "mentor", "accountant", "coordinator", "hr", "receptionist");

module.exports = {
  auth,
  requireRoles,
  // shorthands
  isAdmin,
  isSuperAdmin,
  isCounsellor,
  isMentor,
  isAccountant,
  isCoordinator,
  isHR,
  isReceptionist,
  isStudent,
  isStaff,
  optionalAuth, 
};



// middleware/activityLogger.middleware.js
//
// Express middleware that logs every mutating request (POST/PUT/PATCH/DELETE)
// to ActivityLog after the response is sent.
//
// USAGE — add to index.js after auth middleware, before routes:
//   const activityLogger = require("./middleware/activityLogger.middleware");
//   app.use(activityLogger);
//
// The logger only fires on 2xx / 3xx responses for write operations.
// GET requests are NOT logged (too noisy; use MongoDB Atlas profiler for those).
// Unauthenticated requests are logged with userId = null.

const ActivityLog = require("../models/ActivityLog");

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Map method + path pattern → human-readable action string
const describeAction = (method, path, user) => {
  const role = user?.role || "anonymous";
  const m    = method.toLowerCase();

  // Lead actions
  if (path.match(/\/leads\/[^/]+\/convert/))       return `${role}.lead.converted`;
  if (path.match(/\/leads\/[^/]+\/lost/))           return `${role}.lead.marked_lost`;
  if (path.match(/\/leads\/[^/]+\/assign/))         return `${role}.lead.assigned`;
  if (path.match(/\/leads\/[^/]+\/status/))         return `${role}.lead.status_changed`;
  if (path.match(/\/leads\/[^/]+\/demo/))           return `${role}.lead.demo_updated`;
  if (path.match(/\/leads\/[^/]+\/followups/))      return `${role}.lead.followup_${m === "post" ? "created" : "updated"}`;
  if (path.match(/\/leads\/[^/]+\/priority/))       return `${role}.lead.priority_changed`;
  if (path.match(/\/leads\/merge/))                 return `${role}.lead.merged`;
  if (path.match(/\/leads\/[^/]+\/documents/))      return `${role}.lead.document_${m === "delete" ? "removed" : "added"}`;
  if (path.match(/\/leads$/) && m === "post")       return `${role}.lead.created`;

  // Student actions
  if (path.match(/\/students\/[^/]+\/approve/))    return `${role}.student.approved`;
  if (path.match(/\/students\/[^/]+\/reject/))     return `${role}.student.rejected`;
  if (path.match(/\/students\/[^/]+\/assign/))     return `${role}.student.course_assigned`;
  if (path.match(/\/students\/[^/]+\/fee/))        return `${role}.fee.${m === "post" ? "created" : "updated"}`;
  if (path.match(/\/students\/[^/]+\/payment/))    return `${role}.payment.recorded`;

  // Course actions
  if (path.match(/\/courses\/[^/]+\/publish/))     return `${role}.course.publish_toggled`;
  if (path.match(/\/admin\/courses/) && m === "delete") return `${role}.course.deleted`;
  if (path.match(/\/admin\/courses/) && m === "post")   return `${role}.course.created`;
  if (path.match(/\/admin\/courses/) && m === "put")    return `${role}.course.updated`;

  // Auth actions
  if (path.match(/\/auth\/login/))    return "auth.login";
  if (path.match(/\/auth\/register/)) return "auth.register";

  // Staff
  if (path.match(/\/staff\/[^/]+\/reset-password/)) return `${role}.staff.password_reset`;
  if (path.match(/\/staff\/[^/]+\/activate/))       return `${role}.staff.activated`;
  if (path.match(/\/staff\/[^/]+\/deactivate/))     return `${role}.staff.deactivated`;
  if (path.match(/\/staff\/[^/]+/) && m === "put")  return `${role}.staff.updated`;
  if (path.match(/\/staff\/[^/]+/) && m === "delete") return `${role}.staff.deleted`;
  if (path.match(/\/staff$/) && m === "post")       return `${role}.staff.created`;
  if (path.match(/\/staff-profile\/[^/]+/) && m === "put") return `${role}.staff.profile_updated`;
  if (path.match(/\/staff-leaves\/[^/]+\/review/)) return `${role}.staff.leave_reviewed`;
  if (path.match(/\/staff-documents\/document\//)) return `${role}.staff.document_${m === "delete" ? "deleted" : "updated"}`;
  if (path.match(/\/staff-documents\/[^/]+/) && m === "post") return `${role}.staff.document_uploaded`;
  if (path.match(/\/permissions\/staff\/[^/]+/) && m === "put") return `${role}.staff.permissions_updated`;

  // Inquiry
  if (path.match(/\/inquiries$/) && m === "post") return "inquiry.submitted";

  return `${role}.${m}.${path.split("/").filter(Boolean).join("_")}`;
};

const activityLogger = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();

  // Hook into the response finish event — fire after the response is sent
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Call the original json() first to send the response
    originalJson(body);

    // Only log 2xx/3xx
    if (res.statusCode >= 400) return;

    const user = req.user || null;
    const resourceInfo = getResourceInfo(req, body);

    // Build the log record — don't await, fire-and-forget
    ActivityLog.create({
      userId:      user?.id    || null,
      userName:    user?.fullName || user?.name || "Anonymous",
      userRole:    user?.role  || null,
      action:      describeAction(req.method, req.path, user),
      resource:    resourceInfo.resource,
      resourceId:  resourceInfo.resourceId,
      description: `${req.method} ${req.originalUrl}`,
      metadata: {
        body:   req.body   ? sanitizeBody(req.body)   : undefined,
        params: req.params || undefined,
      },
      ipAddress:  getClientIp(req),
      userAgent:  req.headers["user-agent"] || null,
      method:     req.method,
      endpoint:   req.originalUrl,
      statusCode: res.statusCode,
    }).catch((err) => console.error("[activityLogger] write failed:", err.message));
  };

  next();
};

const getResourceInfo = (req, body = {}) => {
  const path = req.path || "";

  if (path.match(/^\/api\/staff(?:\/|$)/)) {
    return {
      resource: "User",
      resourceId: req.params.id || body?.data?._id?.toString() || body?.data?.id || null,
    };
  }

  if (path.match(/^\/api\/staff-profile\//)) {
    return { resource: "User", resourceId: req.params.id || null };
  }

  if (path.match(/^\/api\/permissions\/staff\//)) {
    return { resource: "User", resourceId: req.params.id || null };
  }

  if (path.match(/^\/api\/staff-leaves\//)) {
    return { resource: "StaffLeave", resourceId: req.params.id || null };
  }

  if (path.match(/^\/api\/staff-documents\//)) {
    return { resource: "StaffDocument", resourceId: req.params.id || null };
  }

  return { resource: null, resourceId: null };
};

// Strip sensitive fields before storing body
const SENSITIVE = new Set([
  "password", "newPassword", "passwordHash", "otp", "resetPasswordOtp",
  "token", "secret", "apiKey", "clientSecret", "privateKey", "accountNumber",
]);
const sanitizeBody = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeBody);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE.has(key) || /secret|token|password|privatekey/i.test(key)
        ? "[REDACTED]"
        : sanitizeBody(nestedValue),
    ])
  );
};

const getClientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.socket?.remoteAddress ||
  null;

module.exports = activityLogger;
// utils/errors/AppError.js
//
// Base class for every "expected" error in the app (as opposed to a bug).
// Any code path that throws an AppError (or a subclass from ./errorTypes)
// is guaranteed to produce a clean, admin-readable JSON response via
// middleware/errorHandler.middleware.js — instead of a generic
// "Internal Server Error".
//
// USAGE:
//   const { NotFoundError } = require("../utils/errors/errorTypes");
//   if (!course) throw new NotFoundError("Course not found");
//
// `isOperational = true` marks this as a "known" error (safe to show the
// message to the client). Anything that is NOT an AppError is treated as an
// unexpected bug — logged in full, but shown to the client as a generic
// message in production (to avoid leaking internals).

class AppError extends Error {
  /**
   * @param {string} message     - human-readable message (safe to show to admins)
   * @param {number} statusCode  - HTTP status code (400, 401, 403, 404, 409, 500, 502...)
   * @param {string} errorCode   - short machine-readable code, e.g. "VALIDATION_ERROR"
   * @param {any}    details     - optional extra info (field errors, offending value, etc.)
   */
  constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
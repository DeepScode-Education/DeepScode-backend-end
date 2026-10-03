// middleware/errorHandler.middleware.js
//
// THE single place where every error in the app becomes an HTTP response.
// Mount `notFoundHandler` after all your routes, and `errorHandler` as the
// very last app.use() in index.js.
//
//   app.use("/api/...", ...routes...);
//   app.use(notFoundHandler);   // unknown routes → 404 AppError
//   app.use(errorHandler);      // MUST be last — Express recognizes it as an
//                               // error handler because it takes 4 args
//
// WHAT IT DOES
// ─────────────────────────────────────────────────────────────────────────────
// 1. Recognizes our own AppError subclasses (utils/errors/errorTypes.js) and
//    uses their statusCode/errorCode/message/details as-is.
// 2. Recognizes common third-party error shapes and converts them into the
//    same clean format:
//      - Mongoose ValidationError   → 400 VALIDATION_ERROR (per-field messages)
//      - Mongoose CastError         → 400 INVALID_ID (bad ObjectId, etc.)
//      - MongoDB duplicate key 11000→ 409 DUPLICATE_ERROR ("X already exists")
//      - Multer errors              → 400 FILE_UPLOAD_ERROR (file too large, etc.)
//      - Cloudinary errors          → 502 CLOUDINARY_ERROR
//      - JWT errors                 → 401 INVALID_TOKEN / TOKEN_EXPIRED
//      - Mongo connection errors    → 500 DATABASE_ERROR
// 3. Anything else (a genuine bug) is treated as unexpected: full detail is
//    logged, but the client gets a safe generic message in production (the
//    real message + stack still show in development for faster debugging).
// 4. Every single error — known or unknown — is logged with full context via
//    utils/logger.js before the response is sent, so nothing is ever silently
//    dropped.

const AppError = require("../utils/errors/AppError");
const { logError } = require("../utils/logger");

const isProd = () => process.env.NODE_ENV === "production";

// ── Convert any error into our standard AppError shape ────────────────────────
const normalizeError = (err) => {
  // Already one of ours — nothing to do
  if (err instanceof AppError) return err;

  // ── Mongoose schema validation ──────────────────────────────────────────────
  if (err.name === "ValidationError" && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    const message = details.map((d) => d.message).join(". ") || "Validation failed.";
    return new AppError(message, 400, "VALIDATION_ERROR", details);
  }

  // ── Mongoose bad ObjectId / type mismatch ───────────────────────────────────
  if (err.name === "CastError") {
    return new AppError(
      `"${err.value}" is not a valid value for "${err.path}".`,
      400,
      "INVALID_ID",
      { field: err.path, value: err.value }
    );
  }

  // ── MongoDB unique-index violation ──────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
    const value = err.keyValue?.[field];
    return new AppError(
      `A record with this ${field}${value ? ` ("${value}")` : ""} already exists.`,
      409,
      "DUPLICATE_ERROR",
      { field, value }
    );
  }

  // ── Multer (file upload) errors ─────────────────────────────────────────────
  if (err.name === "MulterError") {
    const friendly = {
      LIMIT_FILE_SIZE: "This file is too large.",
      LIMIT_FILE_COUNT: "Too many files were uploaded at once.",
      LIMIT_UNEXPECTED_FILE: "An unexpected file field was received.",
      LIMIT_FIELD_COUNT: "Too many form fields were submitted.",
    };
    return new AppError(
      friendly[err.code] || `File upload failed: ${err.message}`,
      400,
      "FILE_UPLOAD_ERROR",
      { multerCode: err.code, field: err.field }
    );
  }

  // ── Our own file-filter rejections (e.g. "Only PDF files are allowed") ──────
  // These arrive as plain Error objects thrown from multer fileFilter callbacks.
  if (/only .*(allowed|permitted)/i.test(err.message || "")) {
    return new AppError(err.message, 400, "FILE_UPLOAD_ERROR");
  }

  // ── Cloudinary SDK errors (carry http_code, or mention cloudinary) ──────────
  if (err.http_code || /cloudinary/i.test(err.message || "")) {
    return new AppError(
      "The file could not be uploaded to media storage. Please try again in a moment.",
      502,
      "CLOUDINARY_ERROR",
      { originalMessage: err.message }
    );
  }

  // ── JWT ──────────────────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return new AppError("Invalid authentication token. Please log in again.", 401, "INVALID_TOKEN");
  }
  if (err.name === "TokenExpiredError") {
    return new AppError("Your session has expired. Please log in again.", 401, "TOKEN_EXPIRED");
  }

  // ── MongoDB connection-level failures ───────────────────────────────────────
  if (err.name === "MongoServerError" || err.name === "MongooseServerSelectionError" || err.name === "MongoNetworkError") {
    return new AppError(
      "We're having trouble reaching the database. Please try again shortly.",
      500,
      "DATABASE_ERROR",
      { originalMessage: err.message }
    );
  }

  // ── Fallback: an unexpected/unclassified error (a real bug) ─────────────────
  return new AppError(
    isProd() ? "Something went wrong on our end. Please try again, and contact support if it persists." : err.message,
    err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500,
    "INTERNAL_ERROR"
  );
};

// ── 404 handler — mount AFTER all real routes, BEFORE errorHandler ────────────
const notFoundHandler = (req, res, next) => {
  next(new AppError(`No route found for ${req.method} ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND"));
};

// ── The centralized handler — MUST be the last middleware registered ─────────
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const normalized = normalizeError(err);

  // Always log the ORIGINAL error (full stack) — not the normalized/sanitized
  // version — so developers see exactly what happened.
  logError(err, req);

  const responseBody = {
    success: false,
    message: normalized.message,
    errorCode: normalized.errorCode,
  };

  if (normalized.details) {
    responseBody.errors = normalized.details;
  }

  // In development, also surface the raw stack to speed up debugging —
  // never in production (avoid leaking internals to the client).
  if (!isProd()) {
    responseBody.stack = err.stack;
  }

  res.status(normalized.statusCode || 500).json(responseBody);
};

module.exports = { errorHandler, notFoundHandler, normalizeError };
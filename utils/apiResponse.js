const { logError } = require("./logger");

const sendSuccess = (res, statusCode = 200, message = "OK", data = null, meta = {}) => {
  const body = { success: true, message, ...meta };
  if (data !== null) body.data = data;
  return res.status(statusCode).json(body);
};

/**
 * sendError(res, statusCode, message, errors?, options?)
 *
 * Backward compatible with the old 4-arg signature used across the codebase
 * (`sendError(res, 500, "Server Error")`), but now also supports passing the
 * original caught error so it gets logged with full stack/context instead of
 * disappearing after `console.log(error)`.
 *
 * @param {object} options
 * @param {Error}  [options.err]         - the original error, for full logging
 * @param {object} [options.req]         - the request, for logging context
 * @param {string} [options.errorCode]   - machine-readable code for the client
 */
const sendError = (res, statusCode = 500, message = "Server error", errors = null, options = {}) => {
  const { err, req, errorCode } = options;

  if (err) {
    logError(err, req);
  }

  const body = { success: false, message };
  if (errorCode) body.errorCode = errorCode;
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

/**
 * Builds a standard pagination meta object.
 * @param {number} total   - total matching documents
 * @param {number} page    - current page (1-indexed)
 * @param {number} limit   - page size
 */
const buildPagination = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage : page < totalPages,
    hasPrevPage : page > 1,
  };
};

module.exports = { sendSuccess, sendError, buildPagination };
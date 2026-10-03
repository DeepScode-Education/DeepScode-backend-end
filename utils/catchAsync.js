// utils/catchAsync.js
//
// Wraps an async Express handler so any thrown error (or rejected promise)
// is automatically forwarded to next(err) — which routes it into the
// centralized error handler (middleware/errorHandler.middleware.js).
//
// Without this, every controller needs its own try/catch that manually
// calls next(err); it's easy to forget, and any forgotten one becomes an
// unhandled rejection that crashes the process or hangs the request.
//
// USAGE:
//   const catchAsync = require("../utils/catchAsync");
//   const { NotFoundError } = require("../utils/errors/errorTypes");
//
//   const getCourseById = catchAsync(async (req, res) => {
//     const course = await Course.findById(req.params.id);
//     if (!course) throw new NotFoundError("Course not found");
//     res.status(200).json({ success: true, data: course });
//   });

module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
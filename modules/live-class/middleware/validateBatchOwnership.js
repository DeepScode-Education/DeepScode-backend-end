// modules/live-class/middleware/validateBatchOwnership.js

const { LiveClass } = require("../models");
const { NotFoundError, AuthorizationError } = require("../../../utils/errors/errorTypes");

// Loads the LiveClass referenced by req.body.liveClassId (or req.params.id)
// onto req.liveClass — used before ownership checks below.
const attachLiveClass = async (req, res, next) => {
  try {
    const liveClassId = req.body.liveClassId || req.params.id;
    if (!liveClassId) throw new NotFoundError("liveClassId is required.");

    const liveClass = await LiveClass.findById(liveClassId);
    if (!liveClass) throw new NotFoundError("Live class not found.");

    req.liveClass = liveClass;
    next();
  } catch (err) {
    next(err);
  }
};

// Mentor must be the host of req.liveClass
const requireMentorIsHost = (req, res, next) => {
  if (String(req.liveClass.mentor) !== String(req.user.id)) {
    return next(new AuthorizationError("You are not the host of this class."));
  }
  next();
};

module.exports = { attachLiveClass, requireMentorIsHost };
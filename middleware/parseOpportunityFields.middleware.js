// middleware/parseOpportunityFields.middleware.js
//
// The Create Opportunity wizard normally posts a plain JSON body, so
// req.body.basic / req.body.role / etc. already arrive as real objects.
// This middleware exists purely as a safety net — same pattern as
// parseCourseFields.middleware.js — in case any caller (Postman, a future
// multipart upload step, etc.) sends these step objects as JSON strings
// instead of native JSON. It parses them BEFORE express-validator runs,
// so validation always sees real objects/arrays regardless of transport.

const JSON_FIELDS = ["basic", "role", "compensation", "eligibility", "settings"];

const parseOpportunityFields = (req, res, next) => {
  JSON_FIELDS.forEach((key) => {
    if (typeof req.body[key] === "string") {
      try {
        req.body[key] = JSON.parse(req.body[key]);
      } catch (_) {
        // leave as-is; the validator will reject it with a clear message
      }
    }
  });
  next();
};

module.exports = parseOpportunityFields;

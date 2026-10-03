// middleware/parseCourseFields.middleware.js
//
// multipart/form-data (multer) sends every field as a raw string — even
// arrays and objects that the frontend JSON.stringify()'d before appending.
// express-validator's isArray()/isObject() checks run on req.body BEFORE
// the controller gets a chance to JSON.parse() anything, so they always
// fail for multipart requests (even though the same payload works fine via
// Postman's raw JSON body, where these fields are already native types).
//
// This middleware parses those fields EARLY — right after multer, before
// validation — so both the validator and the controller see real
// arrays/objects regardless of whether the request was JSON or multipart.

const JSON_FIELDS = [
  "roadmap",
  "portfolioProjects",
  "faqs",
  "highlights",
  "whatsIncluded",
  "toolsCovered",
  "learningOutcomes",
  "careerOpportunities",
  "certification",
  "pricing",
  "seo",
  "publishing",
  "downloads",
  "stats",
  "placement",
];

const parseCourseFields = (req, res, next) => {
  JSON_FIELDS.forEach((key) => {
    if (typeof req.body[key] === "string") {
      try {
        req.body[key] = JSON.parse(req.body[key]);
      } catch (_) {
        // leave as-is; validator will reject it with a clear message
      }
    }
  });
  next();
};

module.exports = parseCourseFields;
/**
 * utils/slugify.js
 *
 * Generates a URL-safe slug from a string and ensures
 * uniqueness against the Course collection.
 */

const Course = require("../models/Course");

/**
 * Converts a string to a slug.
 * "UI/UX Design Course" → "uiux-design-course"
 */
const toSlug = (str = "") =>
  str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // strip special chars except spaces & hyphens
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-");            // collapse multiple hyphens

/**
 * Generates a unique slug for a course.
 * If "ui-ux-design" exists, tries "ui-ux-design-2", "ui-ux-design-3", …
 *
 * @param {string} base         - raw string to slugify (usually the course title)
 * @param {string} [excludeId]  - MongoDB _id to exclude (for updates — skip the current doc)
 */
const generateUniqueSlug = async (base, excludeId = null) => {
  const slug = toSlug(base);
  let candidate = slug;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };

    // eslint-disable-next-line no-await-in-loop
    const existing = await Course.findOne(query).select("_id").lean();
    if (!existing) return candidate;

    counter += 1;
    candidate = `${slug}-${counter}`;
  }
};

module.exports = { toSlug, generateUniqueSlug };
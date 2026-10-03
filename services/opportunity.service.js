const slugify = require("slugify");
const mongoose = require("mongoose");

const Opportunity = require("../models/Opportunity");
const { buildPagination } = require("../utils/apiResponse");
const {
  ValidationError,
  NotFoundError,
  DuplicateError,
} = require("../utils/errors/errorTypes");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── Slug helper ────────────────────────────────────────────────────────────────
const generateUniqueSlug = async (title, excludeId = null) => {
  const base = slugify(title || "opportunity", { lower: true, strict: true, trim: true }) || "opportunity";
  let candidate = base;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };

    // eslint-disable-next-line no-await-in-loop
    const existing = await Opportunity.findOne(query).select("_id").lean();
    if (!existing) return candidate;

    counter += 1;
    candidate = `${base}-${counter}`;
  }
};

// Coerces "" / undefined → null, otherwise Number(value)
const toNumberOrNull = (value) => {
  if (value === "" || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

// ─── Map the 6-step wizard payload (basic / role / compensation / eligibility /
// settings) onto the flat Opportunity schema. Only sections that are actually
// present in the request body are touched — this lets createOpportunity and
// updateOpportunity share the exact same mapper. ────────────────────────────────
const buildOpportunityPayload = (body = {}) => {
  const basic         = body.basic         || {};
  const role           = body.role         || {};
  const compensation   = body.compensation || {};
  const eligibility    = body.eligibility  || {};
  const settings       = body.settings     || {};

  const payload = {};

  // ── Step 1: Basic Info ───────────────────────────────────────────────────────
  if (basic.hiringPartner !== undefined) payload.hiringPartner = basic.hiringPartner || null;
  if (basic.companyEntity     !== undefined) payload.companyEntity     = basic.companyEntity;
  if (basic.internalJobCode   !== undefined) payload.internalJobCode   = basic.internalJobCode;
 if (basic.hiringManager     !== undefined) payload.hiringManager     = (basic.hiringManager || "").trim();
  if (basic.department        !== undefined) payload.department        = basic.department;
  if (basic.primaryLocation   !== undefined) payload.primaryLocation   = basic.primaryLocation;
  if (basic.urgentRequirement !== undefined) payload.urgentRequirement = Boolean(basic.urgentRequirement);

  // ── Step 2: Role Details ─────────────────────────────────────────────────────
  if (role.jobTitle          !== undefined) payload.jobTitle          = role.jobTitle;
  if (role.category          !== undefined) payload.category          = role.category;
  if (role.employmentType    !== undefined) payload.employmentType    = role.employmentType;
  if (role.workMode          !== undefined) payload.workMode          = role.workMode;
  if (role.openings          !== undefined) payload.openings          = toNumberOrNull(role.openings) || 1;
  if (role.description       !== undefined) payload.description       = role.description;
  if (role.responsibilities  !== undefined) payload.responsibilities  = role.responsibilities;
  if (role.requiredSkills    !== undefined) payload.requiredSkills    = role.requiredSkills;
  if (role.niceToHaveSkills  !== undefined) payload.niceToHaveSkills  = role.niceToHaveSkills;

  // ── Step 3: Compensation ─────────────────────────────────────────────────────
  if (compensation.compensationType !== undefined) payload.compensationType = compensation.compensationType;
  if (compensation.currency         !== undefined) payload.currency         = compensation.currency;
  if (compensation.payMin           !== undefined) payload.payMin           = toNumberOrNull(compensation.payMin);
  if (compensation.payMax           !== undefined) payload.payMax           = toNumberOrNull(compensation.payMax);
  if (compensation.payPeriod        !== undefined) payload.payPeriod        = compensation.payPeriod;
  if (compensation.benefits         !== undefined) payload.benefits         = compensation.benefits;

  const hasIncentiveField =
    compensation.performanceBonus      !== undefined ||
    compensation.performanceBonusValue !== undefined ||
    compensation.signOnBonus           !== undefined ||
    compensation.signOnBonusValue      !== undefined;

  if (hasIncentiveField) {
    payload.incentives = {
      performanceBonus:      Boolean(compensation.performanceBonus),
      performanceBonusValue: toNumberOrNull(compensation.performanceBonusValue),
      signOnBonus:           Boolean(compensation.signOnBonus),
      signOnBonusValue:      toNumberOrNull(compensation.signOnBonusValue),
    };
  }

  // ── Step 4: Eligibility ──────────────────────────────────────────────────────
  if (Object.keys(eligibility).length > 0) {
    payload.eligibility = {
      experienceLevel:  eligibility.experienceLevel || "",
      minYears:         toNumberOrNull(eligibility.minYears),
      education:        eligibility.education || "",
      notes:            eligibility.notes || "",
      workAuthRequired: Boolean(eligibility.workAuthRequired),
      backgroundCheck:  Boolean(eligibility.backgroundCheck),
    };
  }

  // ── Step 5: Settings ─────────────────────────────────────────────────────────
  if (Object.keys(settings).length > 0) {
    payload.settings = {
      applicationDeadline: settings.applicationDeadline ? new Date(settings.applicationDeadline) : null,
      applicationLimit:    toNumberOrNull(settings.applicationLimit),
      visibility:          settings.visibility || "Internal",
      autoScreening:       settings.autoScreening !== undefined ? Boolean(settings.autoScreening) : true,
      alertRecipients:     settings.alertRecipients || [],
    };
  }

  // ── Status (sent alongside the wizard payload on Publish) ───────────────────
  if (body.status !== undefined) payload.status = body.status;

  return payload;
};

// ─── Create ─────────────────────────────────────────────────────────────────────
const createOpportunity = async (body, userId) => {
  const payload = buildOpportunityPayload(body);

  if (!payload.jobTitle || !payload.jobTitle.trim()) {
    throw new ValidationError("Job title is required.", [{ field: "role.jobTitle", message: "Job title is required." }]);
  }

  payload.slug = await generateUniqueSlug(payload.jobTitle);
  payload.createdBy = userId;
  payload.updatedBy = userId;

  try {
    return await Opportunity.create(payload);
  } catch (err) {
    if (err.code === 11000) {
      throw new DuplicateError("An opportunity with this slug already exists — try a slightly different job title.");
    }
    throw err;
  }
};

// ─── Update ─────────────────────────────────────────────────────────────────────
const updateOpportunity = async (id, body, userId) => {
  if (!isValidId(id)) throw new ValidationError("Invalid opportunity ID.", { field: "id", value: id });

  const opportunity = await Opportunity.findById(id);
  if (!opportunity) throw new NotFoundError(`No opportunity was found with ID "${id}".`);

  const payload = buildOpportunityPayload(body);

  if (payload.jobTitle && payload.jobTitle !== opportunity.jobTitle) {
    payload.slug = await generateUniqueSlug(payload.jobTitle, id);
  }

  payload.updatedBy = userId;

  Object.assign(opportunity, payload);

  try {
    await opportunity.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new DuplicateError("An opportunity with this slug already exists — try a slightly different job title.");
    }
    throw err;
  }

  return opportunity;
};

// ─── Admin listing — pagination + search (same shape as career.service.js) ────
const getAdminOpportunities = async (query = {}) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    status = "",
    department = "",
    visibility = "",
  } = query;

  const filter = {};
  if (status)     filter.status     = status;
  if (department) filter.department = department;
  if (visibility) filter["settings.visibility"] = visibility;

  if (search && search.trim()) {
    filter.$or = [
      { jobTitle:        { $regex: search.trim(), $options: "i" } },
      { department:      { $regex: search.trim(), $options: "i" } },
      { primaryLocation: { $regex: search.trim(), $options: "i" } },
      { internalJobCode: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip     = (pageNum - 1) * limitNum;

  const [opportunities, total] = await Promise.all([
    Opportunity.find(filter)
      // .populate("hiringManager", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Opportunity.countDocuments(filter),
  ]);

   // NEW — attach live applicant counts for the current page
  const OpportunityApplication = require("./OpportunityApplication".replace("./", "../models/"));
  const ids = opportunities.map((o) => o._id);
  const counts = await OpportunityApplication.aggregate([
    { $match: { opportunity: { $in: ids } } },
    { $group: { _id: "$opportunity", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const enriched = opportunities.map((o) => {
    const obj = o.toObject();
    obj.applicationCount = countMap.get(String(o._id)) || 0;
    return obj;
  });

return { opportunities: enriched, pagination: buildPagination(total, pageNum, limitNum) };
};
// ─── Get single (admin) ─────────────────────────────────────────────────────────
const getOpportunityById = async (id) => {
  if (!isValidId(id)) throw new ValidationError("Invalid opportunity ID.", { field: "id", value: id });

  // const opportunity = await Opportunity.findById(id).populate("hiringManager", "fullName email");
  const opportunity = await Opportunity.findById(id);
  if (!opportunity) throw new NotFoundError(`No opportunity was found with ID "${id}".`);

  return opportunity;
};

// ─── Soft delete ────────────────────────────────────────────────────────────────
const deleteOpportunity = async (id) => {
  if (!isValidId(id)) throw new ValidationError("Invalid opportunity ID.", { field: "id", value: id });

  const opportunity = await Opportunity.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
      deletedAt: new Date(),
      status: "draft",
      "settings.visibility": "Internal",
    },
    { new: true }
  );

  if (!opportunity) throw new NotFoundError(`No opportunity was found with ID "${id}".`);
  return opportunity;
};

// ─── Publish / draft toggle ─────────────────────────────────────────────────────
const updateStatus = async (id, status) => {
  if (!isValidId(id)) throw new ValidationError("Invalid opportunity ID.", { field: "id", value: id });

  const { STATUSES } = Opportunity;
  if (!STATUSES.includes(status)) {
    throw new ValidationError(`Status must be one of: ${STATUSES.join(", ")}.`, { field: "status", value: status });
  }

  const opportunity = await Opportunity.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!opportunity) throw new NotFoundError(`No opportunity was found with ID "${id}".`);
  return opportunity;
};

// ─── Public listing — published + Public visibility only ──────────────────────
const getPublishedOpportunities = async (query = {}) => {
  const { search = "", department = "", workMode = "", category = "" } = query;

  const filter = {
    status: "published",
    "settings.visibility": "Public",
  };

  if (department) filter.department = department;
  if (workMode)   filter.workMode   = workMode;
  if (category)   filter.category   = category;

  if (search && search.trim()) {
    filter.jobTitle = { $regex: search.trim(), $options: "i" };
  }

  return Opportunity.find(filter)
    .select("-eligibility.notes -settings.alertRecipients -settings.applicationLimit")
    .sort({ urgentRequirement: -1, createdAt: -1 });
};

module.exports = {
  generateUniqueSlug,
  buildOpportunityPayload,
  createOpportunity,
  updateOpportunity,
  getAdminOpportunities,
  getOpportunityById,
  deleteOpportunity,
  updateStatus,
  getPublishedOpportunities,
};

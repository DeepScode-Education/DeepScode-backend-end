const slugify = require("slugify");
const mongoose = require("mongoose");

const HiringPartner = require("../models/HiringPartner");
const Opportunity = require("../models/Opportunity");
const { buildPagination } = require("../utils/apiResponse");
const {
  ValidationError,
  NotFoundError,
  DuplicateError,
} = require("../utils/errors/errorTypes");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── Slug helper — identical pattern to opportunity.service.js ────────────────
const generateUniqueSlug = async (name, excludeId = null) => {
  const base = slugify(name || "partner", { lower: true, strict: true, trim: true }) || "partner";
  let candidate = base;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };

    // eslint-disable-next-line no-await-in-loop
    const existing = await HiringPartner.findOne(query).select("_id").lean();
    if (!existing) return candidate;

    counter += 1;
    candidate = `${base}-${counter}`;
  }
};

const buildHiringPartnerPayload = (body = {}) => {
  const payload = {};

  if (body.companyName !== undefined) payload.companyName = body.companyName;
  if (body.industry !== undefined) payload.industry = body.industry;
  if (body.logo !== undefined) payload.logo = body.logo;
  if (body.description !== undefined) payload.description = body.description;
  if (body.website !== undefined) payload.website = body.website;
  if (body.tier !== undefined) payload.tier = body.tier;
  if (body.isActive !== undefined) payload.isActive = Boolean(body.isActive);

  if (body.totalHires !== undefined) {
    payload.stats = { totalHires: Math.max(0, parseInt(body.totalHires, 10) || 0) };
  }

  return payload;
};

// ─── Create ─────────────────────────────────────────────────────────────────────
const createHiringPartner = async (body, userId) => {
  const payload = buildHiringPartnerPayload(body);

  if (!payload.companyName || !payload.companyName.trim()) {
    throw new ValidationError("Company name is required.", [
      { field: "companyName", message: "Company name is required." },
    ]);
  }

  payload.slug = await generateUniqueSlug(payload.companyName);
  payload.createdBy = userId;
  payload.updatedBy = userId;

  try {
    return await HiringPartner.create(payload);
  } catch (err) {
    if (err.code === 11000) {
      throw new DuplicateError("A hiring partner with this name already exists — try a slightly different name.");
    }
    throw err;
  }
};

// ─── Update ─────────────────────────────────────────────────────────────────────
const updateHiringPartner = async (id, body, userId) => {
  if (!isValidId(id)) throw new ValidationError("Invalid hiring partner ID.", { field: "id", value: id });

  const partner = await HiringPartner.findById(id);
  if (!partner) throw new NotFoundError(`No hiring partner was found with ID "${id}".`);

  const payload = buildHiringPartnerPayload(body);

  if (payload.companyName && payload.companyName !== partner.companyName) {
    payload.slug = await generateUniqueSlug(payload.companyName, id);
  }

  // Merge stats separately so a partial update never wipes totalHires unintentionally
  if (payload.stats) {
    partner.stats = { ...partner.stats.toObject?.() ?? partner.stats, ...payload.stats };
    delete payload.stats;
  }

  payload.updatedBy = userId;
  Object.assign(partner, payload);

  try {
    await partner.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new DuplicateError("A hiring partner with this name already exists — try a slightly different name.");
    }
    throw err;
  }

  return partner;
};

// ─── Admin listing — pagination + search + tier filter ────────────────────────
const getAdminHiringPartners = async (query = {}) => {
  const { page = 1, limit = 20, search = "", tier = "", isActive = "" } = query;

  const filter = {};
  if (tier) filter.tier = tier;
  if (isActive !== "") filter.isActive = isActive === "true";

  if (search && search.trim()) {
    filter.$or = [
      { companyName: { $regex: search.trim(), $options: "i" } },
      { industry: { $regex: search.trim(), $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [partners, total] = await Promise.all([
    HiringPartner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    HiringPartner.countDocuments(filter),
  ]);

  // Attach live-computed openRoles per partner in the same round trip
  const partnerIds = partners.map((p) => p._id);
  const openRoleCounts = await Opportunity.aggregate([
    { $match: { hiringPartner: { $in: partnerIds }, status: "published" } },
    { $group: { _id: "$hiringPartner", count: { $sum: 1 } } },
  ]);
  const openRolesMap = new Map(openRoleCounts.map((r) => [String(r._id), r.count]));

  const enriched = partners.map((p) => {
    const obj = p.toObject();
    obj.openRoles = openRolesMap.get(String(p._id)) || 0;
    obj.totalHires = p.stats?.totalHires || 0;
    return obj;
  });

  return { partners: enriched, pagination: buildPagination(total, pageNum, limitNum) };
};

// ─── Get single (admin) ─────────────────────────────────────────────────────────
const getHiringPartnerById = async (id) => {
  if (!isValidId(id)) throw new ValidationError("Invalid hiring partner ID.", { field: "id", value: id });

  const partner = await HiringPartner.findById(id);
  if (!partner) throw new NotFoundError(`No hiring partner was found with ID "${id}".`);

  return partner;
};

// ─── Detailed view — partner + linked opportunities + computed stats ──────────
const getHiringPartnerDetail = async (id) => {
  if (!isValidId(id)) throw new ValidationError("Invalid hiring partner ID.", { field: "id", value: id });

  const partner = await HiringPartner.findById(id);
  if (!partner) throw new NotFoundError(`No hiring partner was found with ID "${id}".`);

  const opportunities = await Opportunity.find({ hiringPartner: id })
    .populate("hiringManager", "fullName email")
    .sort({ createdAt: -1 });

  const openRoles = opportunities.filter((o) => o.status === "published").length;

  return {
    partner,
    opportunities,
    openRoles,
    totalHires: partner.stats?.totalHires || 0,
  };
};

// ─── Soft delete ────────────────────────────────────────────────────────────────
const deleteHiringPartner = async (id) => {
  if (!isValidId(id)) throw new ValidationError("Invalid hiring partner ID.", { field: "id", value: id });

  const partner = await HiringPartner.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date(), isActive: false },
    { new: true }
  );

  if (!partner) throw new NotFoundError(`No hiring partner was found with ID "${id}".`);
  return partner;
};

// ─── Dashboard stats: Total Partners, Premier Partners, Open Roles, Total Hires ─
const getDashboardStats = async () => {
  const [totalPartners, premierPartners, openRolesCount, hiresAgg] = await Promise.all([
    HiringPartner.countDocuments({}),
    HiringPartner.countDocuments({ tier: "Premier" }),
    Opportunity.countDocuments({ status: "published", hiringPartner: { $ne: null } }),
    HiringPartner.aggregate([{ $group: { _id: null, total: { $sum: "$stats.totalHires" } } }]),
  ]);

  return {
    totalPartners,
    premierPartners,
    openRoles: openRolesCount,
    totalHires: hiresAgg[0]?.total || 0,
  };
};

module.exports = {
  generateUniqueSlug,
  buildHiringPartnerPayload,
  createHiringPartner,
  updateHiringPartner,
  getAdminHiringPartners,
  getHiringPartnerById,
  getHiringPartnerDetail,
  deleteHiringPartner,
  getDashboardStats,
};
const catchAsync = require("../utils/catchAsync");
const hiringPartnerService = require("../services/hiringPartner.service");

const sendSuccess = (res, code, message, data = null, meta = {}) => {
  const body = { success: true, message, ...meta };
  if (data !== null) body.data = data;
  return res.status(code).json(body);
};

// ── POST /api/admin/hiring-partners ──
const createHiringPartner = catchAsync(async (req, res) => {
  const partner = await hiringPartnerService.createHiringPartner(req.body, req.user.id);
  return sendSuccess(res, 201, "Hiring partner created successfully", partner);
});

// ── PUT /api/admin/hiring-partners/:id ──
const updateHiringPartner = catchAsync(async (req, res) => {
  const partner = await hiringPartnerService.updateHiringPartner(req.params.id, req.body, req.user.id);
  return sendSuccess(res, 200, "Hiring partner updated successfully", partner);
});

// ── GET /api/admin/hiring-partners ── (pagination + search + tier filter)
const getAllHiringPartners = catchAsync(async (req, res) => {
  const { partners, pagination } = await hiringPartnerService.getAdminHiringPartners(req.query);
  return sendSuccess(res, 200, "Hiring partners fetched successfully", partners, { pagination });
});

// ── GET /api/admin/hiring-partners/:id ──
const getHiringPartnerById = catchAsync(async (req, res) => {
  const partner = await hiringPartnerService.getHiringPartnerById(req.params.id);
  return sendSuccess(res, 200, "Hiring partner fetched successfully", partner);
});

// ── GET /api/admin/hiring-partners/:id/detail ──
// Partner + linked opportunities + computed openRoles/totalHires
const getHiringPartnerDetail = catchAsync(async (req, res) => {
  const detail = await hiringPartnerService.getHiringPartnerDetail(req.params.id);
  return sendSuccess(res, 200, "Hiring partner detail fetched successfully", detail);
});

// ── DELETE /api/admin/hiring-partners/:id ── (soft delete)
const deleteHiringPartner = catchAsync(async (req, res) => {
  await hiringPartnerService.deleteHiringPartner(req.params.id);
  return sendSuccess(res, 200, "Hiring partner deleted successfully");
});

// ── GET /api/admin/hiring-partners/dashboard/stats ──
const getDashboardStats = catchAsync(async (req, res) => {
  const stats = await hiringPartnerService.getDashboardStats();
  return sendSuccess(res, 200, "Dashboard stats fetched successfully", stats);
});

module.exports = {
  createHiringPartner,
  updateHiringPartner,
  getAllHiringPartners,
  getHiringPartnerById,
  getHiringPartnerDetail,
  deleteHiringPartner,
  getDashboardStats,
};
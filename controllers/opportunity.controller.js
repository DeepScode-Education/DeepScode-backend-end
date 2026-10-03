const catchAsync = require("../utils/catchAsync");
const opportunityService = require("../services/opportunity.service");

const sendSuccess = (res, code, message, data = null, meta = {}) => {
  const body = { success: true, message, ...meta };
  if (data !== null) body.data = data;
  return res.status(code).json(body);
};

// ── POST /api/admin/opportunities ──
// Single endpoint for the entire 6-step wizard payload:
// { basic, role, compensation, eligibility, settings, status? }
const createOpportunity = catchAsync(async (req, res) => {
  const opportunity = await opportunityService.createOpportunity(req.body, req.user.id);

  return sendSuccess(
    res,
    201,
    opportunity.status === "published"
      ? "Opportunity created and published successfully"
      : "Opportunity saved as draft",
    opportunity
  );
});

// ── PUT /api/admin/opportunities/:id ──
// Same wizard payload shape — used for edits and for "Publish" from Review step.
const updateOpportunity = catchAsync(async (req, res) => {
  const opportunity = await opportunityService.updateOpportunity(req.params.id, req.body, req.user.id);

  return sendSuccess(
    res,
    200,
    opportunity.status === "published"
      ? "Opportunity updated and published successfully"
      : "Opportunity updated successfully",
    opportunity
  );
});

// ── GET /api/admin/opportunities ── (admin listing: pagination + search + filters)
const getAllOpportunities = catchAsync(async (req, res) => {
  const { opportunities, pagination } = await opportunityService.getAdminOpportunities(req.query);

  return sendSuccess(res, 200, "Opportunities fetched successfully", opportunities, { pagination });
});

// ── GET /api/admin/opportunities/:id ──
const getOpportunityById = catchAsync(async (req, res) => {
  const opportunity = await opportunityService.getOpportunityById(req.params.id);

  return sendSuccess(res, 200, "Opportunity fetched successfully", opportunity);
});

// ── DELETE /api/admin/opportunities/:id ── (soft delete)
const deleteOpportunity = catchAsync(async (req, res) => {
  await opportunityService.deleteOpportunity(req.params.id);

  return sendSuccess(res, 200, "Opportunity deleted successfully");
});

// ── PATCH /api/admin/opportunities/:id/status ── (draft <-> published)
const updateStatus = catchAsync(async (req, res) => {
  const opportunity = await opportunityService.updateStatus(req.params.id, req.body.status);

  return sendSuccess(
    res,
    200,
    opportunity.status === "published" ? "Opportunity published" : "Opportunity moved back to draft",
    opportunity
  );
});

// ── GET /api/opportunities ── (public — published + visibility: Public only)
const getPublishedOpportunities = catchAsync(async (req, res) => {
  const opportunities = await opportunityService.getPublishedOpportunities(req.query);

  return sendSuccess(res, 200, "Opportunities fetched successfully", opportunities, {
    count: opportunities.length,
  });
});

module.exports = {
  createOpportunity,
  updateOpportunity,
  getAllOpportunities,
  getOpportunityById,
  deleteOpportunity,
  updateStatus,
  getPublishedOpportunities,
};

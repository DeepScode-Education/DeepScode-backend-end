const AdLead = require("../models/AdLead");
const { AD_LEAD_STATUSES, AD_LEAD_FORM_TYPES } = require("../models/AdLead");

const createAdLead = async (req, res) => {
  try {
    const fields = [
      "fullName",
      "email",
      "phone",
      "city",
      "profile",
      "mode",
      "experience",
      "course",
      "formType",
      "landingPage",
      "campaign",
      "adGroup",
      "keyword",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "utmTerm",
      "utmContent",
    ];
    const leadData = Object.fromEntries(
      fields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]])
    );

    leadData.ipAddress = req.ip || "";
    leadData.userAgent = req.get("user-agent") || "";

    const lead = await AdLead.create(leadData);
    return res.status(201).json({
      success: true,
      message: "Ad lead submitted successfully.",
      data: lead,
    });
  } catch (error) {
    console.error("createAdLead error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getAdLeads = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.formType) filter.formType = req.query.formType;

    const [leads, total] = await Promise.all([
      AdLead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AdLead.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("getAdLeads error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getAdLeadById = async (req, res) => {
  try {
    const lead = await AdLead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Ad lead not found." });
    }

    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error("getAdLeadById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateAdLeadStatus = async (req, res) => {
  try {
    const updates = { status: req.body.status };
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.status === "converted") updates.convertedAt = new Date();

    const lead = await AdLead.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!lead) {
      return res.status(404).json({ success: false, message: "Ad lead not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Ad lead status updated successfully.",
      data: lead,
    });
  } catch (error) {
    console.error("updateAdLeadStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const getAdLeadStats = async (_req, res) => {
  try {
    const [total, statusCounts, formTypeCounts] = await Promise.all([
      AdLead.countDocuments(),
      AdLead.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      AdLead.aggregate([{ $group: { _id: "$formType", count: { $sum: 1 } } }]),
    ]);
    const byStatus = Object.fromEntries(AD_LEAD_STATUSES.map((status) => [status, 0]));
    const byFormType = Object.fromEntries(AD_LEAD_FORM_TYPES.map((formType) => [formType, 0]));

    for (const entry of statusCounts) byStatus[entry._id] = entry.count;
    for (const entry of formTypeCounts) byFormType[entry._id] = entry.count;

    return res.status(200).json({
      success: true,
      data: { total, byStatus, byFormType },
    });
  } catch (error) {
    console.error("getAdLeadStats error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createAdLead,
  getAdLeads,
  getAdLeadById,
  updateAdLeadStatus,
  getAdLeadStats,
};

const mongoose = require("mongoose");
const OpportunityApplication = require("../models/OpportunityApplication");
const Opportunity = require("../models/Opportunity");
const cloudinary = require("../config/Cloudinary");
const { sanitizeLinks, validateLinks } = require("../utils/portfolioLinks"); // NEW

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const uploadResumeBuffer = (buffer, originalname) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "deepScode/opportunity-applications",
        resource_type: "raw",
        public_id: `${originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_")}-${Date.now()}`,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

// POST /api/opportunities/:id/apply  (any authenticated user)
const applyToOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid opportunity ID");

    const opportunity = await Opportunity.findOne({ _id: id, status: "published" });
    if (!opportunity) {
      return send(res, 404, false, "This opportunity is not open for applications");
    }

    const { fullName, email, phone, coverLetter } = req.body;
    if (!fullName || !fullName.trim()) return send(res, 400, false, "Full name is required");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return send(res, 400, false, "A valid email is required");
    }

    // ── NEW: parse + validate links[] (sent as a JSON string over multipart) ──
    let links = [];
    if (req.body.links !== undefined) {
      let rawLinks;
      try {
        rawLinks = typeof req.body.links === "string" ? JSON.parse(req.body.links) : req.body.links;
      } catch {
        return send(res, 400, false, "Invalid links format");
      }
      links = sanitizeLinks(rawLinks);
      const linkErrors = validateLinks(links);
      if (linkErrors.length) {
        return send(res, 400, false, linkErrors.join("; "));
      }
    }

    const alreadyApplied = await OpportunityApplication.findOne({
      opportunity: id,
      applicant: req.user.id,
    });
    if (alreadyApplied) {
      return send(res, 409, false, "You have already applied for this opportunity");
    }

    if (opportunity.settings?.applicationDeadline && new Date() > new Date(opportunity.settings.applicationDeadline)) {
      return send(res, 400, false, "The application deadline for this opportunity has passed");
    }

    if (opportunity.settings?.applicationLimit) {
      const count = await OpportunityApplication.countDocuments({ opportunity: id });
      if (count >= opportunity.settings.applicationLimit) {
        return send(res, 400, false, "This opportunity has reached its application limit");
      }
    }

    let resume = {};
    if (req.file) {
      const uploaded = await uploadResumeBuffer(req.file.buffer, req.file.originalname);
      resume = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        originalName: req.file.originalname,
      };
    }

    const application = await OpportunityApplication.create({
      opportunity: id,
      applicant: req.user.id,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      coverLetter: coverLetter?.trim() || "",
      resume,
      links, // NEW
    });

    return send(res, 201, true, "Application submitted successfully", application);
  } catch (error) {
    if (error.code === 11000) {
      return send(res, 409, false, "You have already applied for this opportunity");
    }
    console.error("applyToOpportunity error:", error);
    return send(res, 500, false, "Server error while submitting application");
  }
};


// GET /api/student/opportunity-applications/mine
const getMyApplications = async (req, res) => {
  try {
    const applications = await OpportunityApplication.find({ applicant: req.user.id })
      .populate("opportunity", "jobTitle companyEntity primaryLocation status employmentType")
      .sort({ createdAt: -1 });
    return send(res, 200, true, "Applications fetched", applications);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// GET /api/admin/opportunities/:id/applications
const getApplicationsForOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid opportunity ID");

    const applications = await OpportunityApplication.find({ opportunity: id })
      .populate("applicant", "fullName email studentId")
      .sort({ createdAt: -1 });

    return send(res, 200, true, "Applications fetched", applications);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

// PATCH /api/admin/opportunities/applications/:appId/status
const updateApplicationStatus = async (req, res) => {
  try {
    const { appId } = req.params;
    const { status, adminRemarks } = req.body;
    if (!isValidId(appId)) return send(res, 400, false, "Invalid application ID");
    if (!OpportunityApplication.STATUSES.includes(status)) {
      return send(res, 400, false, `Status must be one of: ${OpportunityApplication.STATUSES.join(", ")}`);
    }

    const application = await OpportunityApplication.findByIdAndUpdate(
      appId,
      { status, ...(adminRemarks !== undefined ? { adminRemarks } : {}) },
      { new: true }
    );
    if (!application) return send(res, 404, false, "Application not found");

    return send(res, 200, true, "Application status updated", application);
  } catch (error) {
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  applyToOpportunity,
  getMyApplications,
  getApplicationsForOpportunity,
  updateApplicationStatus,
};
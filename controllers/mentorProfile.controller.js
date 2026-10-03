const mongoose = require("mongoose");
const MentorProfile = require("../models/MentorProfile");
const User = require("../models/User");
const cloudinary = require("../config/Cloudinary");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const uploadBufferToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

// Whitelist — only these top-level keys can be written via create/update.
// This is what makes "save partial tab data" safe: the admin form only
// sends the fields for the tab it's on, and everything else is preserved.
const EDITABLE_FIELDS = [
  "heroImage", "heroImagePublicId", "description", "experience",
  "studentsCountLabel", "projects", "ratingLabel", "languages", "status",
  "about", "expertise",
  "careerMilestones",
  "featuredProjects", "artStationUrl",
  "toolkit",
  "testimonials",
  "courses",
  "faqs",
  "seo",
];

// ── POST /api/admin/mentor-profile ──
const createMentorProfile = async (req, res) => {
  try {
    const { mentor } = req.body;
    if (!mentor || !isValidId(mentor)) {
      return send(res, 400, false, "A valid mentor ID is required");
    }

    const mentorUser = await User.findOne({ _id: mentor, role: "mentor" });
    if (!mentorUser) return send(res, 404, false, "Mentor not found");

    const existing = await MentorProfile.findOne({ mentor });
    if (existing) {
      return send(res, 409, false, "A profile already exists for this mentor — use update instead.", existing);
    }

    const payload = { mentor, createdBy: req.user.id, updatedBy: req.user.id };
    EDITABLE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    });

    const profile = await MentorProfile.create(payload);
    return send(res, 201, true, "Mentor profile created successfully", profile);
  } catch (error) {
    console.error("createMentorProfile error:", error);
    if (error.code === 11000) return send(res, 409, false, "A profile already exists for this mentor");
    if (error.name === "ValidationError") {
      return send(res, 400, false, Object.values(error.errors).map((e) => e.message).join(". "));
    }
    return send(res, 500, false, "Server Error");
  }
};

// ── GET /api/admin/mentor-profile ──
const getAllMentorProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", isPublished } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (isPublished !== undefined) filter.isPublished = isPublished === "true";

    if (search.trim()) {
      const matchingMentors = await User.find({
        role: "mentor",
        fullName: { $regex: search.trim(), $options: "i" },
      }).select("_id");
      filter.mentor = { $in: matchingMentors.map((m) => m._id) };
    }

    const [profiles, total] = await Promise.all([
      MentorProfile.find(filter)
        .populate("mentor", "fullName email photoUrl designation company slug isActive")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      MentorProfile.countDocuments(filter),
    ]);

    return send(res, 200, true, "Mentor profiles fetched", profiles, {
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAllMentorProfiles error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ── GET /api/admin/mentor-profile/:id ──
// :id may be a MentorProfile _id OR the mentor's User _id (whichever the
// admin panel has on hand — the mentor list only knows the User id).
const getMentorProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ID");

    const populateFields =
      "fullName email photoUrl designation company phone bio expertise linkedinUrl instagramUrl rating studentsCount slug isActive";

    let profile =
      (await MentorProfile.findOne({ _id: id }).populate("mentor", populateFields)) ||
      (await MentorProfile.findOne({ mentor: id }).populate("mentor", populateFields));

    if (!profile) {
      // No profile yet — return the mentor's basic info so the admin form
      // can pre-fill Tab 1 and create the profile on first save.
      const mentorUser = await User.findOne({ _id: id, role: "mentor" }).select(populateFields);
      if (!mentorUser) return send(res, 404, false, "Mentor not found");
      return send(res, 200, true, "No profile created yet for this mentor", { mentor: mentorUser, isNew: true });
    }

    return send(res, 200, true, "Mentor profile fetched", profile);
  } catch (error) {
    console.error("getMentorProfileById error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ── PUT /api/admin/mentor-profile/:id ──
// :id is the mentor's User _id. Upserts — this is what enables "save any
// tab independently, draft, come back later" without a separate create step.
const updateMentorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ID");

    const mentorUser = await User.findOne({ _id: id, role: "mentor" });

    let profile = mentorUser
      ? await MentorProfile.findOne({ mentor: mentorUser._id })
      : await MentorProfile.findById(id);

    if (!profile && !mentorUser) {
      return send(res, 404, false, "Mentor profile not found");
    }

    const update = { updatedBy: req.user.id };
    EDITABLE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    if (!profile) {
      profile = await MentorProfile.create({ mentor: mentorUser._id, createdBy: req.user.id, ...update });
    } else {
      Object.assign(profile, update);
      await profile.save();
    }

    return send(res, 200, true, "Mentor profile updated successfully", profile);
  } catch (error) {
    console.error("updateMentorProfile error:", error);
    if (error.name === "ValidationError") {
      return send(res, 400, false, Object.values(error.errors).map((e) => e.message).join(". "));
    }
    return send(res, 500, false, "Server Error");
  }
};

// ── DELETE /api/admin/mentor-profile/:id ──
const deleteMentorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ID");

    const profile = await MentorProfile.findOneAndDelete({ $or: [{ _id: id }, { mentor: id }] });
    if (!profile) return send(res, 404, false, "Mentor profile not found");

    return send(res, 200, true, "Mentor profile deleted successfully");
  } catch (error) {
    console.error("deleteMentorProfile error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ── PATCH /api/admin/mentor-profile/:id/publish ──
const togglePublish = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return send(res, 400, false, "Invalid ID");

    const { isPublished } = req.body;

    const profile = await MentorProfile.findOneAndUpdate(
      { $or: [{ _id: id }, { mentor: id }] },
      { isPublished: Boolean(isPublished), updatedBy: req.user.id },
      { new: true }
    );

    if (!profile) return send(res, 404, false, "Mentor profile not found");
    return send(res, 200, true, isPublished ? "Mentor profile published" : "Mentor profile unpublished", profile);
  } catch (error) {
    console.error("togglePublish error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ── POST /api/admin/mentor-profile/upload-image ──
// Generic single-image upload reused by every tab (hero image, a project
// image, a testimonial photo, a course thumbnail) — same pattern as your
// existing portfolioUpload.controller.js. Frontend uploads first, gets back
// { url, publicId }, then includes that in the tab's save payload.
const uploadMentorProfileImage = async (req, res) => {
  try {
    if (!req.file) return send(res, 400, false, "No file received");

    const result = await uploadBufferToCloudinary(req.file.buffer, "deepScode/mentor-profile");

    return send(res, 200, true, "Image uploaded successfully", {
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("uploadMentorProfileImage error:", error);
    return send(res, 500, false, "Server Error");
  }
};

module.exports = {
  createMentorProfile,
  getAllMentorProfiles,
  getMentorProfileById,
  updateMentorProfile,
  deleteMentorProfile,
  togglePublish,
  uploadMentorProfileImage,
};
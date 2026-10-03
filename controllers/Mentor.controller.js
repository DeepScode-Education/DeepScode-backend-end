// // controllers/Mentor.controller.js
// //
// // SINGLE SOURCE OF TRUTH: Saara mentor data User collection mein store hota hai
// // role: "mentor" ke saath. Mentor collection ab use nahi hoti.
// //
// // GET    /api/mentors     → User (role: mentor, isActive: true)
// // POST   /api/mentors     → User.create (role: mentor)
// // PUT    /api/mentors/:id → User.findByIdAndUpdate
// // DELETE /api/mentors/:id → User isActive: false (soft delete)

// const User = require("../models/User");
// const cloudinary = require("../config/Cloudinary");
// const bcrypt = require("bcryptjs");
// const MentorProfile = require("../models/MentorProfile"); 
// const { toSlug } = require("../utils/slugify");



// const generateUniqueMentorSlug = async (name, excludeId = null) => {
//   const base = toSlug(name);
//   let candidate = base;
//   let counter = 1;
//   // eslint-disable-next-line no-constant-condition
//   while (true) {
//     const query = { slug: candidate };
//     if (excludeId) query._id = { $ne: excludeId };
//     const existing = await User.findOne(query).select("_id").lean();
//     if (!existing) return candidate;
//     counter += 1;
//     candidate = `${base}-${counter}`;
//   }
// };


// // ─── Cloudinary buffer upload helper ─────────────────────────────────────────
// const uploadBufferToCloudinary = (buffer) =>
//   new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder: "deepScode/mentors", resource_type: "image" },
//       (err, result) => (err ? reject(err) : resolve(result))
//     );
//     stream.end(buffer);
//   });

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// const send = (res, status, success, message, data, extra = {}) => {
//   const body = { success, message, ...extra };
//   if (data !== undefined) body.data = data;
//   return res.status(status).json(body);
// };

// const parseExpertise = (raw) => {
//   if (!raw) return [];
//   if (Array.isArray(raw)) return raw.map((s) => s.trim()).filter(Boolean);
//   try {
//     const parsed = JSON.parse(raw);
//     if (Array.isArray(parsed)) return parsed.map((s) => s.trim()).filter(Boolean);
//   } catch (_) {}
//   return raw.split(",").map((s) => s.trim()).filter(Boolean);
// };

// // User doc ko Teachers card format mein map karo
// const mapUserToMentor = (u) => ({
//   _id: u._id,
//   slug: u.slug || "",  
//   name: u.fullName,
//   email: u.email,
//   phone: u.phone || "",
//   designation: u.designation || "",
//   company: u.company || "",
//   bio: u.bio || "",
//   photoUrl: u.photoUrl || "",
//   expertise: u.expertise || [],
//   linkedinUrl: u.linkedinUrl || "",
//   instagramUrl: u.instagramUrl || "",
//   rating: u.rating || 5,
//   studentsCount: u.studentsCount || 0,
//   isActive: u.isActive,
//   createdAt: u.createdAt,
// });

// // ─── GET /api/mentors ─────────────────────────────────────────────────────────
// const getMentors = async (req, res) => {
//   try {
//     const mentors = await User.find({ role: "mentor", isActive: true })
//       .select(
//         "fullName email phone designation company bio photoUrl expertise linkedinUrl instagramUrl rating studentsCount isActive createdAt"
//       )
//       .sort({ fullName: 1 })
//       .lean();

//     return send(res, 200, true, "Mentors fetched", mentors.map(mapUserToMentor), {
//       count: mentors.length,
//     });
//   } catch (error) {
//     console.error("getMentors error:", error);
//     return send(res, 500, false, "Server Error");
//   }
// };

// // ─── GET /api/mentors/:id ─────────────────────────────────────────────────────
// const getMentorById = async (req, res) => {
//   try {
//     const mentor = await User.findOne({ _id: req.params.id, role: "mentor" })
//       .select(
//         "fullName email phone designation company bio photoUrl expertise linkedinUrl instagramUrl rating studentsCount isActive createdAt"
//       )
//       .lean();

//     if (!mentor) return send(res, 404, false, "Mentor not found");
//     return send(res, 200, true, "Mentor fetched", mapUserToMentor(mentor));
//   } catch (error) {
//     console.error("getMentorById error:", error);
//     return send(res, 500, false, "Server Error");
//   }
// };

// // ─── POST /api/mentors ────────────────────────────────────────────────────────
// // Teachers page "Add Teacher" → User collection mein save hoga (role: mentor)
// // Staff Management mein bhi automatically dikhai dega
// const createMentor = async (req, res) => {
//   try {
//     const {
//       name, email, phone,
//       designation, company, bio,
//       photoUrl: bodyPhotoUrl,
//       linkedinUrl, instagramUrl,
//       rating, studentsCount,
//     } = req.body;

//     if (!name?.trim()) return send(res, 400, false, "Name is required");
//     if (!email?.trim()) return send(res, 400, false, "Email is required");

//     const normalizedEmail = email.toLowerCase().trim();

//     // Duplicate check
//     const existing = await User.findOne({ email: normalizedEmail });
//     if (existing) {
//       return send(res, 409, false, "An account with this email already exists");
//     }

//     // Photo upload
//     let photoUrl = bodyPhotoUrl?.trim() || null;
//     if (req.file) {
//       const result = await uploadBufferToCloudinary(req.file.buffer);
//       photoUrl = result.secure_url;
//     }

//     const expertise = parseExpertise(req.body.expertise);

//     // Default password: name ke first word + @deepScode123
//     // Admin baad mein Staff Management se reset kar sakta hai
//     const defaultPassword = `deepScode@1234`;
//     const hashedPassword = await bcrypt.hash(defaultPassword, 10);

//     const slug = await generateUniqueMentorSlug(name.trim());

//     const mentor = await User.create({
//       fullName: name.trim(),
//       email: normalizedEmail,
//       password: hashedPassword,
//       role: "mentor",
//       isActive: true,
//       status: "approved",
//       approvedAt: new Date(),
//       createdBy: req.user?.id || null,
//       // Mentor-specific fields
//       phone: phone?.trim() || undefined,
//       designation: designation?.trim() || undefined,
//       company: company?.trim() || undefined,
//       bio: bio?.trim() || undefined,
//       photoUrl: photoUrl || undefined,
//       expertise: expertise,
//       linkedinUrl: linkedinUrl?.trim() || undefined,
//       instagramUrl: instagramUrl?.trim() || undefined,
//       rating: rating ? Number(rating) : 5,
//       studentsCount: studentsCount ? Number(studentsCount) : 0,
//     });

//     return send(res, 201, true, "Mentor created successfully", mapUserToMentor(mentor.toObject()));
//   } catch (error) {
//     if (error.code === 11000) {
//       return send(res, 409, false, "A mentor with this email already exists");
//     }
//     console.error("createMentor error:", error);
//     return send(res, 500, false, "Server Error");
//   }
// };

// // ─── PUT /api/mentors/:id ─────────────────────────────────────────────────────
// const updateMentor = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const mentor = await User.findOne({ _id: id, role: "mentor" });
//     if (!mentor) return send(res, 404, false, "Mentor not found");

//     // Photo upload
//     let newPhotoUrl = null;
//     if (req.file) {
//       const result = await uploadBufferToCloudinary(req.file.buffer);
//       newPhotoUrl = result.secure_url;
//     }

//     const expertise = parseExpertise(req.body.expertise);
//     const {
//       name, email, phone,
//       designation, company, bio,
//       photoUrl: bodyPhotoUrl,
//       linkedinUrl, instagramUrl,
//       rating, studentsCount,
//     } = req.body;

//     const updatePayload = {};
//     // if (name !== undefined) updatePayload.fullName = name.trim();
//     if (name !== undefined) {
//       updatePayload.fullName = name.trim();
//       updatePayload.slug = await generateUniqueMentorSlug(name.trim(), id);
//     }
//     if (email !== undefined) updatePayload.email = email.toLowerCase().trim();
//     if (phone !== undefined) updatePayload.phone = phone?.trim() || undefined;
//     if (designation !== undefined) updatePayload.designation = designation?.trim() || undefined;
//     if (company !== undefined) updatePayload.company = company?.trim() || undefined;
//     if (bio !== undefined) updatePayload.bio = bio?.trim() || undefined;
//     if (req.body.expertise !== undefined) updatePayload.expertise = expertise;
//     if (linkedinUrl !== undefined) updatePayload.linkedinUrl = linkedinUrl?.trim() || undefined;
//     if (instagramUrl !== undefined) updatePayload.instagramUrl = instagramUrl?.trim() || undefined;
//     if (rating !== undefined) updatePayload.rating = Number(rating);
//     if (studentsCount !== undefined) updatePayload.studentsCount = Number(studentsCount);

//     // Photo
//     if (newPhotoUrl) {
//       updatePayload.photoUrl = newPhotoUrl;
//     } else if (bodyPhotoUrl !== undefined) {
//       updatePayload.photoUrl = bodyPhotoUrl?.trim() || null;
//     }

//     const updated = await User.findByIdAndUpdate(
//       id,
//       { $set: updatePayload },
//       { new: true, runValidators: false }
//     )
//       .select(
//         "fullName email phone designation company bio photoUrl expertise linkedinUrl instagramUrl rating studentsCount isActive createdAt"
//       )
//       .lean();

//     return send(res, 200, true, "Mentor updated successfully", mapUserToMentor(updated));
//   } catch (error) {
//     if (error.code === 11000) {
//       return send(res, 409, false, "A mentor with this email already exists");
//     }
//     console.error("updateMentor error:", error);
//     return send(res, 500, false, "Server Error");
//   }
// };

// // ─── DELETE /api/mentors/:id ──────────────────────────────────────────────────
// // Soft delete — isActive: false
// // Staff Management mein bhi Inactive ho jaayega
// const deleteMentor = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const mentor = await User.findOneAndUpdate(
//       { _id: id, role: "mentor" },
//       { isActive: false },
//       { new: true }
//     );

//     if (!mentor) return send(res, 404, false, "Mentor not found");
//     return send(res, 200, true, "Mentor removed successfully");
//   } catch (error) {
//     console.error("deleteMentor error:", error);
//     return send(res, 500, false, "Server Error");
//   }
// };

// const getMentorDetailBySlug = async (req, res) => {
//   try {
//     const { slug } = req.params;

//     const mentorUser = await User.findOne({ slug, role: "mentor", isActive: true }).select(
//       "fullName email phone designation company bio photoUrl expertise linkedinUrl instagramUrl rating studentsCount slug"
//     );

//     if (!mentorUser) return send(res, 404, false, "Mentor not found");

//     const profile = await MentorProfile.findOne({
//       mentor: mentorUser._id,
//       isPublished: true,
//     }).lean();

//     const merged = {
//       slug: mentorUser.slug,
//       name: mentorUser.fullName,
//       designation: mentorUser.designation || "",
//       company: mentorUser.company || "",
//       photoUrl: mentorUser.photoUrl || "",
//       heroImage: profile?.heroImage || mentorUser.photoUrl || "",
//       experience: profile?.experience || "",
//       studentsCount: profile?.studentsCountLabel || mentorUser.studentsCount || 0,
//       projects: profile?.projects || "",
//       rating: profile?.ratingLabel || mentorUser.rating || 5,
//       languages: profile?.languages || "",
//       status: profile?.status || "Available",
//       description: profile?.description || mentorUser.bio || "",

//       about: profile?.about?.length ? profile.about : undefined,
//       expertise: profile?.expertise?.length ? profile.expertise : mentorUser.expertise,

//       careerMilestones: profile?.careerMilestones || [],
//       featuredProjects: profile?.featuredProjects || [],
//       artStationUrl: profile?.artStationUrl || "",
//       toolkit: profile?.toolkit || null,
//       testimonials: profile?.testimonials || [],
//       courses: profile?.courses || [],
//       faqs: profile?.faqs || [],
//     };

//     return send(res, 200, true, "Mentor detail fetched", merged);
//   } catch (error) {
//     console.error("getMentorDetailBySlug error:", error);
//     return send(res, 500, false, "Server Error");
//   }
// };

// module.exports = { getMentors, getMentorById, createMentor, updateMentor, deleteMentor, getMentorDetailBySlug };


// controllers/Mentor.controller.js
//
// SINGLE SOURCE OF TRUTH: Saara mentor data User collection mein store hota hai
// role: "mentor" ke saath. Mentor collection ab use nahi hoti.
//
// GET    /api/mentors     → User (role: mentor, isActive: true)
// POST   /api/mentors     → User.create (role: mentor)
// PUT    /api/mentors/:id → User.findByIdAndUpdate
// DELETE /api/mentors/:id → User isActive: false (soft delete)

const User = require("../models/User");
const cloudinary = require("../config/Cloudinary");
const bcrypt = require("bcryptjs");
const MentorProfile = require("../models/MentorProfile");
const { toSlug } = require("../utils/slugify");

// Fields returned to the frontend for every mentor record.
// IMPORTANT: keep `slug` in this string everywhere it's used, or the
// mapper below will silently return an empty slug.
const MENTOR_SELECT_FIELDS =
  "fullName designation company bio photoUrl expertise linkedinUrl instagramUrl rating studentsCount isActive createdAt slug";

const generateUniqueMentorSlug = async (name, excludeId = null) => {
  const base = toSlug(name);
  let candidate = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await User.findOne(query).select("_id").lean();
    if (!existing) return candidate;
    counter += 1;
    candidate = `${base}-${counter}`;
  }
};

// ─── Cloudinary buffer upload helper ─────────────────────────────────────────
const uploadBufferToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "deepScode/mentors", resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const parseExpertise = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => s.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => s.trim()).filter(Boolean);
  } catch (_) {}
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

// Public mentor DTO: intentionally excludes private contact/auth fields.
const mapUserToMentor = (u) => ({
  _id: u._id,
  slug: u.slug || "",
  name: u.fullName,
  designation: u.designation || "",
  company: u.company || "",
  bio: u.bio || "",
  photoUrl: u.photoUrl || "",
  expertise: u.expertise || [],
  linkedinUrl: u.linkedinUrl || "",
  instagramUrl: u.instagramUrl || "",
  rating: u.rating || 5,
  studentsCount: u.studentsCount || 0,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

// ─── GET /api/mentors ─────────────────────────────────────────────────────────
const getMentors = async (req, res) => {
  try {
    const mentors = await User.find({ role: "mentor", isActive: true })
      .select(MENTOR_SELECT_FIELDS)
      .sort({ fullName: 1 })
      .lean();

    return send(res, 200, true, "Mentors fetched", mentors.map(mapUserToMentor), {
      count: mentors.length,
    });
  } catch (error) {
    console.error("getMentors error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ─── GET /api/mentors/:id ─────────────────────────────────────────────────────
const getMentorById = async (req, res) => {
  try {
    const mentor = await User.findOne({ _id: req.params.id, role: "mentor" })
      .select(MENTOR_SELECT_FIELDS)
      .lean();

    if (!mentor) return send(res, 404, false, "Mentor not found");
    return send(res, 200, true, "Mentor fetched", mapUserToMentor(mentor));
  } catch (error) {
    console.error("getMentorById error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ─── POST /api/mentors ────────────────────────────────────────────────────────
// Teachers page "Add Teacher" → User collection mein save hoga (role: mentor)
// Staff Management mein bhi automatically dikhai dega
const createMentor = async (req, res) => {
  try {
    const {
      name, email, phone,
      designation, company, bio,
      photoUrl: bodyPhotoUrl,
      linkedinUrl, instagramUrl,
      rating, studentsCount,
    } = req.body;

    if (!name?.trim()) return send(res, 400, false, "Name is required");
    if (!email?.trim()) return send(res, 400, false, "Email is required");

    const normalizedEmail = email.toLowerCase().trim();

    // Duplicate check
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return send(res, 409, false, "An account with this email already exists");
    }

    // Photo upload
    let photoUrl = bodyPhotoUrl?.trim() || null;
    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer);
      photoUrl = result.secure_url;
    }

    const expertise = parseExpertise(req.body.expertise);

    // Default password: name ke first word + @deepScode123
    // Admin baad mein Staff Management se reset kar sakta hai
    const defaultPassword = `deepScode@1234`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // ── FIX: slug generate karke create payload mein bhi bhejna zaroori hai ──
    const slug = await generateUniqueMentorSlug(name.trim());

    const mentor = await User.create({
      fullName: name.trim(),
      slug, // ← FIX: pehle yeh missing tha
      email: normalizedEmail,
      password: hashedPassword,
      role: "mentor",
      isActive: true,
      status: "approved",
      approvedAt: new Date(),
      createdBy: req.user?.id || null,
      // Mentor-specific fields
      phone: phone?.trim() || undefined,
      designation: designation?.trim() || undefined,
      company: company?.trim() || undefined,
      bio: bio?.trim() || undefined,
      photoUrl: photoUrl || undefined,
      expertise: expertise,
      linkedinUrl: linkedinUrl?.trim() || undefined,
      instagramUrl: instagramUrl?.trim() || undefined,
      rating: rating ? Number(rating) : 5,
      studentsCount: studentsCount ? Number(studentsCount) : 0,
    });

    return send(res, 201, true, "Mentor created successfully", mapUserToMentor(mentor.toObject()));
  } catch (error) {
    if (error.code === 11000) {
      return send(res, 409, false, "A mentor with this email already exists");
    }
    console.error("createMentor error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ─── PUT /api/mentors/:id ─────────────────────────────────────────────────────
const updateMentor = async (req, res) => {
  try {
    const { id } = req.params;

    const mentor = await User.findOne({ _id: id, role: "mentor" });
    if (!mentor) return send(res, 404, false, "Mentor not found");

    // Photo upload
    let newPhotoUrl = null;
    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer);
      newPhotoUrl = result.secure_url;
    }

    const expertise = parseExpertise(req.body.expertise);
    const {
      name, email, phone,
      designation, company, bio,
      photoUrl: bodyPhotoUrl,
      linkedinUrl, instagramUrl,
      rating, studentsCount,
    } = req.body;

    const updatePayload = {};
    if (name !== undefined) {
      updatePayload.fullName = name.trim();
      updatePayload.slug = await generateUniqueMentorSlug(name.trim(), id);
    }
    if (email !== undefined) updatePayload.email = email.toLowerCase().trim();
    if (phone !== undefined) updatePayload.phone = phone?.trim() || undefined;
    if (designation !== undefined) updatePayload.designation = designation?.trim() || undefined;
    if (company !== undefined) updatePayload.company = company?.trim() || undefined;
    if (bio !== undefined) updatePayload.bio = bio?.trim() || undefined;
    if (req.body.expertise !== undefined) updatePayload.expertise = expertise;
    if (linkedinUrl !== undefined) updatePayload.linkedinUrl = linkedinUrl?.trim() || undefined;
    if (instagramUrl !== undefined) updatePayload.instagramUrl = instagramUrl?.trim() || undefined;
    if (rating !== undefined) updatePayload.rating = Number(rating);
    if (studentsCount !== undefined) updatePayload.studentsCount = Number(studentsCount);

    // Photo
    if (newPhotoUrl) {
      updatePayload.photoUrl = newPhotoUrl;
    } else if (bodyPhotoUrl !== undefined) {
      updatePayload.photoUrl = bodyPhotoUrl?.trim() || null;
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: false }
    )
      .select(MENTOR_SELECT_FIELDS)
      .lean();

    return send(res, 200, true, "Mentor updated successfully", mapUserToMentor(updated));
  } catch (error) {
    if (error.code === 11000) {
      return send(res, 409, false, "A mentor with this email already exists");
    }
    console.error("updateMentor error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ─── DELETE /api/mentors/:id ──────────────────────────────────────────────────
// Soft delete — isActive: false
// Staff Management mein bhi Inactive ho jaayega
const deleteMentor = async (req, res) => {
  try {
    const { id } = req.params;

    const mentor = await User.findOneAndUpdate(
      { _id: id, role: "mentor" },
      { isActive: false },
      { new: true }
    );

    if (!mentor) return send(res, 404, false, "Mentor not found");
    return send(res, 200, true, "Mentor removed successfully");
  } catch (error) {
    console.error("deleteMentor error:", error);
    return send(res, 500, false, "Server Error");
  }
};

// ─── GET /api/mentors/profile/:slug (PUBLIC) ─────────────────────────────────
// Merges basic identity from User with detail-page content from MentorProfile.
// Only a PUBLISHED profile is exposed publicly.
const getMentorDetailBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const mentorUser = await User.findOne({ slug, role: "mentor", isActive: true }).select(
      "fullName designation company bio photoUrl expertise linkedinUrl instagramUrl rating studentsCount slug"
    );

    if (!mentorUser) return send(res, 404, false, "Mentor not found");

    const profile = await MentorProfile.findOne({
      mentor: mentorUser._id,
      isPublished: true,
    }).lean();

    const merged = {
      slug: mentorUser.slug,
      name: mentorUser.fullName,
      designation: mentorUser.designation || "",
      company: mentorUser.company || "",
      photoUrl: mentorUser.photoUrl || "",
      heroImage: profile?.heroImage || mentorUser.photoUrl || "",
      experience: profile?.experience || "",
      studentsCount: profile?.studentsCountLabel || mentorUser.studentsCount || 0,
      projects: profile?.projects || "",
      rating: profile?.ratingLabel || mentorUser.rating || 5,
      languages: profile?.languages || "",
      status: profile?.status || "Available",
      description: profile?.description || mentorUser.bio || "",

      about: profile?.about?.length ? profile.about : undefined,
      expertise: profile?.expertise?.length ? profile.expertise : mentorUser.expertise,

      careerMilestones: profile?.careerMilestones || [],
      featuredProjects: profile?.featuredProjects || [],
      artStationUrl: profile?.artStationUrl || "",
      toolkit: profile?.toolkit || null,
      testimonials: profile?.testimonials || [],
      courses: profile?.courses || [],
      faqs: profile?.faqs || [],
    };

    return send(res, 200, true, "Mentor detail fetched", merged);
  } catch (error) {
    console.error("getMentorDetailBySlug error:", error);
    return send(res, 500, false, "Server Error");
  }
};

module.exports = {
  getMentors,
  getMentorById,
  createMentor,
  updateMentor,
  deleteMentor,
  getMentorDetailBySlug,
  mapUserToMentor,
};
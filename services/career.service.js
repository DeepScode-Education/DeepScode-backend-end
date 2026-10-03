const slugify = require("slugify");
const Career = require("../models/Career");

/**
 * Generate Unique Slug
 */
const generateUniqueSlug = async (title, excludeId = null) => {
  let slug = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });

  let finalSlug = slug;
  let count = 1;

  while (true) {
    const existing = await Career.findOne({
      slug: finalSlug,
      ...(excludeId && { _id: { $ne: excludeId } }),
    });

    if (!existing) break;

    finalSlug = `${slug}-${count++}`;
  }

  return finalSlug;
};

/**
 * Create Career
 */
const createCareer = async (payload, userId) => {
  const slug = await generateUniqueSlug(payload.title);

  const career = await Career.create({
    ...payload,
    slug,
    createdBy: userId,
    updatedBy: userId,
  });

  return career;
};

/**
 * Update Career
 */
const updateCareer = async (careerId, payload, userId) => {
  const career = await Career.findOne({
    _id: careerId,
    isDeleted: false,
  });

  if (!career) {
    throw new Error("Career not found");
  }

  if (
    payload.title &&
    payload.title.trim() !== career.title
  ) {
    payload.slug = await generateUniqueSlug(
      payload.title,
      careerId
    );
  }

  Object.assign(career, payload);

  career.updatedBy = userId;

  await career.save();

  return career;
};

/**
 * Soft Delete
 */
const deleteCareer = async (careerId) => {
  const career = await Career.findOne({
    _id: careerId,
    isDeleted: false,
  });

  if (!career) {
    throw new Error("Career not found");
  }

  career.isDeleted = true;

  await career.save();

  return career;
};

/**
 * Get Career By ID
 */
const getCareerById = async (careerId) => {
  return Career.findOne({
    _id: careerId,
    isDeleted: false,
  })
    .populate("createdBy", "fullName email")
    .populate("updatedBy", "fullName email");
};

/**
 * Admin List
 */
const getAdminCareers = async ({
  page = 1,
  limit = 10,
  search = "",
  department,
  status,
}) => {
  const filter = {
    isDeleted: false,
  };

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  if (department) {
    filter.department = department;
  }

  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Career.find(filter)
      .sort({
        featured: -1,
        sortOrder: 1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    Career.countDocuments(filter),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
  };
};

/**
 * Public Jobs
 */
const getPublishedCareers = async () => {
  return Career.find({
    isDeleted: false,
    status: "Published",
  }).sort({
    featured: -1,
    sortOrder: 1,
    createdAt: -1,
  });
};

/**
 * Update Status
 */
const updateStatus = async (
  careerId,
  status
) => {
  return Career.findByIdAndUpdate(
    careerId,
    {
      status,
    },
    {
      new: true,
    }
  );
};

const getCareerBySlug = async (slug) => {
  return Career.findOne({
    slug,
    status: "Published",
    isDeleted: false,
  });
};

module.exports = {
  createCareer,
  updateCareer,
  deleteCareer,
  getCareerById,
  getAdminCareers,
  getPublishedCareers,
  updateStatus,
   getCareerBySlug,
};
const Portfolio = require("../models/Portfolio");
const Course = require("../models/Course");

// Fields admin must never overwrite directly through the generic update API.
const PROTECTED_FIELDS = [
  "student",
  "course",
  "createdAt",
  "updatedAt",
  "views",
  "approvedBy",
  "approvedAt",
  "publishedAt",
  "_id",
];


// ADD helper functions (reuses the same slug pattern as portfolio.service.js):
const generateSlug = (title) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateUniquePortfolioSlug = async (title) => {
  const base = generateSlug(title);
  let slug = base;
  let counter = 1;
  while (await Portfolio.findOne({ slug })) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
};


/**
 * Admin creates a portfolio for a former/external student.
 * No User/Enrollment/Assignment records are touched.
 */
// const createExternalPortfolio = async (payload, adminId) => {
//   const {
//     studentName,
//     studentEmail,
//     studentBatch,
//     course,
//     title,
//     description,
//     thumbnail,
//     gallery,
//     githubUrl,
//     liveUrl,
//     figmaUrl,
//     behanceUrl,
//     videoUrl,
//     driveUrl,
//     technologies,
//     tags,
//     featured,
//     publish,
//   } = payload;

//   if (!studentName || !studentName.trim()) {
//     throw new Error("Student name is required");
//   }
//   if (!course) {
//     throw new Error("Course is required");
//   }
//   if (!title || !title.trim()) {
//     throw new Error("Project title is required");
//   }
//   if (!description || !description.trim()) {
//     throw new Error("Project description is required");
//   }

//   const courseDoc = await Course.findById(course);
//   if (!courseDoc) {
//     throw new Error("Invalid course selected");
//   }

//   const slug = await generateUniquePortfolioSlug(title);

//   const portfolioData = {
//     student: null,
//     externalStudent: true,
//     studentName: studentName.trim(),
//     studentEmail: studentEmail ? studentEmail.trim() : "",
//     studentBatch: studentBatch ? studentBatch.trim() : "",

//     course: courseDoc._id,
//     courseTitle: courseDoc.title,
//     category: courseDoc.category,

//     title: title.trim(),
//     slug,
//     description: description.trim(),

//     thumbnail: thumbnail || undefined,
//     gallery: gallery || [],

//     githubUrl: githubUrl || "",
//     liveUrl: liveUrl || "",
//     figmaUrl: figmaUrl || "",
//     behanceUrl: behanceUrl || "",
//     videoUrl: videoUrl || "",
//     driveUrl: driveUrl || "",

//     technologies: technologies || [],
//     tags: tags || [],

//     featured: !!featured,

//     status: "draft",
//   };

//   if (publish) {
//     portfolioData.status = "published";
//     portfolioData.publishedAt = new Date();
//     portfolioData.approvedBy = adminId;
//     portfolioData.approvedAt = new Date();
//   }

//   return Portfolio.create(portfolioData);
// };



const createExternalPortfolio = async (payload, adminId) => {
  const {
    studentName,
    studentEmail,
    studentBatch,
    studentPhoto,      // NEW
    studentReview,     // NEW
    course,
    title,
    description,
    thumbnail,
    gallery,
    githubUrl,
    liveUrl,
    figmaUrl,
    behanceUrl,
    videoUrl,
    driveUrl,
    technologies,
    tags,
    featured,
    publish,
  } = payload;

  if (!studentName || !studentName.trim()) {
    throw new Error("Student name is required");
  }
  if (!course) {
    throw new Error("Course is required");
  }
  if (!title || !title.trim()) {
    throw new Error("Project title is required");
  }
  if (!description || !description.trim()) {
    throw new Error("Project description is required");
  }

  const courseDoc = await Course.findById(course);
  if (!courseDoc) {
    throw new Error("Invalid course selected");
  }

  const slug = await generateUniquePortfolioSlug(title);

  const portfolioData = {
    student: null,
    externalStudent: true,
    studentName: studentName.trim(),
    studentEmail: studentEmail ? studentEmail.trim() : "",
    studentBatch: studentBatch ? studentBatch.trim() : "",
    studentPhoto: studentPhoto || undefined,           // NEW
    studentReview: studentReview ? studentReview.trim() : "", // NEW

    course: courseDoc._id,
    courseTitle: courseDoc.title,
    category: courseDoc.category,

    title: title.trim(),
    slug,
    description: description.trim(),

    thumbnail: thumbnail || undefined,
    gallery: gallery || [],

    githubUrl: githubUrl || "",
    liveUrl: liveUrl || "",
    figmaUrl: figmaUrl || "",
    behanceUrl: behanceUrl || "",
    videoUrl: videoUrl || "",
    driveUrl: driveUrl || "",

    technologies: technologies || [],
    tags: tags || [],

    featured: !!featured,

    status: "draft",
  };

  if (publish) {
    portfolioData.status = "published";
    portfolioData.publishedAt = new Date();
    portfolioData.approvedBy = adminId;
    portfolioData.approvedAt = new Date();
  }

  return Portfolio.create(portfolioData);
};
/**
 * Get All Portfolio For Admin
 * Search + Filter + Pagination
 */
const getAllPortfolios = async (query) => {
  const { page = 1, limit = 10, status, category, search } = query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      {
        title: {
          $regex: search,
          $options: "i",
        },
      },
      {
        courseTitle: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  const skip = (page - 1) * limit;

  const [portfolios, total] = await Promise.all([
    Portfolio.find(filter)
      .populate("student", "fullName email")
      .populate("course", "title category")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(Number(limit)),

    Portfolio.countDocuments(filter),
  ]);

  return {
    portfolios,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get Single Portfolio
 */
const getPortfolioById = async (id) => {
  const portfolio = await Portfolio.findById(id)
    .populate("student", "fullName email")
    .populate("course", "title category")
    .populate("approvedBy", "fullName email");

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  return portfolio;
};

/**
 * Admin Update Portfolio
 * Full editing rights, minus a short protected-field list.
 */
const updatePortfolio = async (id, payload) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  Object.keys(payload).forEach((key) => {
    if (PROTECTED_FIELDS.includes(key)) return;
    portfolio[key] = payload[key];
  });

  await portfolio.save();

  return portfolio;
};

/**
 * Delete Portfolio
 */
const deletePortfolio = async (id) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  await portfolio.deleteOne();

  return true;
};

/**
 * Approve Portfolio
 */
// const approvePortfolio = async (id, adminId) => {
//   const portfolio = await Portfolio.findById(id);

//   if (!portfolio) {
//     throw new Error("Portfolio not found");
//   }

//   portfolio.status = "approved";
//   portfolio.approvedBy = adminId;
//   portfolio.approvedAt = new Date();

//   await portfolio.save();

//   return portfolio;
// };

const approvePortfolio = async (id, adminId) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  if (!portfolio.technologies || portfolio.technologies.length === 0) {
    throw new Error("Add at least one technology before approving");
  }

  portfolio.status = "approved";
  portfolio.approvedBy = adminId;
  portfolio.approvedAt = new Date();

  await portfolio.save();

  return portfolio;
};

/**
 * Reject Portfolio
 */
const rejectPortfolio = async (id, remark) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  portfolio.status = "rejected";
  portfolio.adminRemarks = remark || "Rejected by admin";

  await portfolio.save();

  return portfolio;
};

/**
 * Publish Portfolio
 */
// const publishPortfolio = async (id) => {
//   const portfolio = await Portfolio.findById(id);

//   if (!portfolio) {
//     throw new Error("Portfolio not found");
//   }

//   if (portfolio.status !== "approved") {
//     throw new Error("Portfolio must be approved before publishing");
//   }

//   portfolio.status = "published";
//   portfolio.publishedAt = new Date();

//   await portfolio.save();

//   return portfolio;
// };

const publishPortfolio = async (id) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  if (portfolio.status !== "approved") {
    throw new Error("Portfolio must be approved before publishing");
  }

  if (!portfolio.technologies || portfolio.technologies.length === 0) {
    throw new Error("Add at least one technology before publishing");
  }

  portfolio.status = "published";
  portfolio.publishedAt = new Date();

  await portfolio.save();

  return portfolio;
};
/**
 * Unpublish Portfolio
 */
const unpublishPortfolio = async (id) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  portfolio.status = "approved";
  portfolio.publishedAt = null;

  await portfolio.save();

  return portfolio;
};

/**
 * Feature / Unfeature Portfolio
 */
const toggleFeatured = async (id) => {
  const portfolio = await Portfolio.findById(id);

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  portfolio.featured = !portfolio.featured;

  await portfolio.save();

  return portfolio;
};

module.exports = {
  getAllPortfolios,
  getPortfolioById,
  updatePortfolio,
  deletePortfolio,
  approvePortfolio,
  rejectPortfolio,
  publishPortfolio,
  unpublishPortfolio,
  toggleFeatured,
  createExternalPortfolio,
};
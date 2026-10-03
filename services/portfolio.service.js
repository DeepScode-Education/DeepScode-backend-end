const Portfolio = require("../models/Portfolio");
const StudentAssignment = require("../models/Studentassignment");
const Course = require("../models/Course");

// slug generator
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Get Student Assigned Course

const getStudentCourse = async (studentId) => {
  const assignment = await StudentAssignment.findOne({
    student: studentId,
    status: "active",
  }).populate("course", "title category");

  if (!assignment) {
    throw new Error("No active course assigned");
  }

  return assignment;
};

// Create Portfolio

const createPortfolio = async (studentId, payload) => {
  const assignment = await getStudentCourse(studentId);

  const course = assignment.course;

  // Link validation

  const hasLink =
    payload.githubUrl ||
    payload.liveUrl ||
    payload.figmaUrl ||
    payload.behanceUrl ||
    payload.videoUrl ||
    payload.driveUrl;

  if (!hasLink) {
    throw new Error("At least one project link is required");
  }

  const portfolio = await Portfolio.create({
    student: studentId,

    course: course._id,

    courseTitle: course.title,

    category: course.category,

    title: payload.title,

    slug: generateSlug(payload.title),

    description: payload.description,

    thumbnail: payload.thumbnail,

    gallery: payload.gallery || [],

    githubUrl: payload.githubUrl || "",

    liveUrl: payload.liveUrl || "",

    figmaUrl: payload.figmaUrl || "",

    behanceUrl: payload.behanceUrl || "",

    videoUrl: payload.videoUrl || "",

    driveUrl: payload.driveUrl || "",

    technologies: payload.technologies || [],

    tags: payload.tags || [],

    status: "draft",
  });

  return portfolio;
};

const getMyPortfolio = async (studentId) => {
  const portfolios = await Portfolio.find({
    student: studentId,
  })
    .populate("course", "title category")
    .sort({
      createdAt: -1,
    });

  return portfolios;
};

/**
 * Update Student Portfolio
 */

// const updatePortfolio = async(
//     portfolioId,
//     studentId,
//     payload
// )=>{

//     const portfolio =
//     await Portfolio.findOne({

//         _id:portfolioId,

//         student:studentId

//     });

//     if(!portfolio){

//         throw new Error(
//             "Portfolio not found"
//         );

//     }

//     // Student can edit only these states

//     if(
//         ![
//             "draft",
//             "needs_changes"
//         ].includes(
//             portfolio.status
//         )
//     ){

//         throw new Error(
//             "Portfolio cannot be edited after submission"
//         );

//     }

//     const allowedFields=[

//         "title",

//         "description",

//         "githubUrl",

//         "liveUrl",

//         "figmaUrl",

//         "behanceUrl",

//         "videoUrl",

//         "driveUrl",

//         "technologies",

//         "tags",

//         "thumbnail",

//         "gallery"

//     ];

//     allowedFields.forEach(field=>{

//         if(
//             payload[field] !== undefined
//         ){

//             portfolio[field]=payload[field];

//         }

//     });

//     await portfolio.save();

//     return portfolio;

// };

// const updatePortfolio = async (portfolioId, studentId, payload) => {
//   const portfolio = await Portfolio.findOne({ _id: portfolioId, student: studentId });

//   if (!portfolio) {
//     throw new Error("Portfolio not found");
//   }

//   // Student can edit only in draft. Once submitted, admin owns the record.
//   if (portfolio.status !== "draft") {
//     throw new Error("Portfolio cannot be edited after submission");
//   }

//   // Student-editable fields ONLY — everything else (category, technologies,
//   // tags, figma/behance/video/drive, featured, status) is admin-controlled.
//   const allowedFields = [
//     "title",
//     "description",
//     "githubUrl",
//     "liveUrl",
//     "thumbnail",
//     "gallery",
//   ];

//   allowedFields.forEach((field) => {
//     if (payload[field] !== undefined) {
//       portfolio[field] = payload[field];
//     }
//   });

//   await portfolio.save();

//   return portfolio;
// };

/**
 * Delete Student Portfolio
 */

const deletePortfolio = async (portfolioId, studentId) => {
  const portfolio = await Portfolio.findOne({
    _id: portfolioId,

    student: studentId,
  });

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  if (portfolio.status === "published") {
    throw new Error("Published portfolio cannot be deleted");
  }

  await portfolio.deleteOne();

  return true;
};

/**
 * Submit Portfolio For Admin Review
 */

// const submitPortfolio = async(
//     portfolioId,
//     studentId
// )=>{

//     const portfolio =
//     await Portfolio.findOne({

//         _id:portfolioId,

//         student:studentId

//     });

//     if(!portfolio){

//         throw new Error(
//             "Portfolio not found"
//         );

//     }

//     if(
//         ![
//             "draft",
//             "needs_changes"
//         ].includes(
//             portfolio.status
//         )
//     ){

//         throw new Error(
//             "Portfolio already submitted"
//         );

//     }

//     // Required Validation Before Submit

//     if(!portfolio.title){

//         throw new Error(
//             "Project title required"
//         );

//     }

//     if(!portfolio.description){

//         throw new Error(
//             "Project description required"
//         );

//     }

//     if(!portfolio.thumbnail){

//         throw new Error(
//             "Project thumbnail required"
//         );

//     }

//     if(
//         !portfolio.technologies ||
//         portfolio.technologies.length===0
//     ){

//         throw new Error(
//             "At least one technology required"
//         );

//     }

//     portfolio.status="pending";

//     portfolio.submittedAt=new Date();

//     await portfolio.save();

//     return portfolio;

// };

const submitPortfolio = async (portfolioId, studentId) => {
  const portfolio = await Portfolio.findOne({
    _id: portfolioId,
    student: studentId,
  });

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  if (portfolio.status !== "draft") {
    throw new Error("Portfolio already submitted");
  }

  // Required validation before submit — technologies/tags are no longer
  // required here since they're filled in by the admin during review.
  if (!portfolio.title) {
    throw new Error("Project title required");
  }

  if (!portfolio.description) {
    throw new Error("Project description required");
  }

  if (!portfolio.thumbnail) {
    throw new Error("Project thumbnail required");
  }

  portfolio.status = "pending";
  portfolio.submittedAt = new Date();

  await portfolio.save();

  return portfolio;
};

/**
 * Update Student Portfolio
 * Student may only touch a locked-down field set, and only while in "draft".
 */
const updatePortfolio = async (portfolioId, studentId, payload) => {
  const portfolio = await Portfolio.findOne({
    _id: portfolioId,
    student: studentId,
  });

  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  if (portfolio.status !== "draft") {
    throw new Error("Portfolio cannot be edited after submission");
  }

  // Student-editable fields — technologies/tags are optional suggestions;
  // admin can still fully edit/override these later during review.
  const allowedFields = [
    "title",
    "description",
    "githubUrl",
    "liveUrl",
    "thumbnail",
    "gallery",
    "technologies",
    "tags",
  ];

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      portfolio[field] = payload[field];
    }
  });

  await portfolio.save();

  return portfolio;
};



// const getPublicPortfolios = async (query) => {
//   const { category, search, page = 1, limit = 12 } = query;

//   const filter = { status: "published" };

//   if (category && category !== "All") {
//     filter.category = category;
//   }

//   if (search) {
//     filter.$or = [
//       { title: { $regex: search, $options: "i" } },
//       { description: { $regex: search, $options: "i" } },
//     ];
//   }

//   const skip = (page - 1) * limit;

//   const [portfolios, total] = await Promise.all([
//     Portfolio.find(filter)
//       .populate("student", "fullName")
//       .select("-adminRemarks -approvedBy -__v")
//       .sort({ featured: -1, publishedAt: -1 })
//       .skip(skip)
//       .limit(Number(limit)),

//     Portfolio.countDocuments(filter),
//   ]);

//   return {
//     portfolios,
//     pagination: {
//       total,
//       page: Number(page),
//       limit: Number(limit),
//       pages: Math.ceil(total / limit),
//     },
//   };
// };

// const sanitizePublicPortfolio = (portfolio) => {
//   if (!portfolio) return null;
//   const plain = portfolio.toObject ? portfolio.toObject() : portfolio;

//   return {
//     _id: plain._id,
//     title: plain.title,
//     slug: plain.slug,
//     description: plain.description,
//     category: plain.category,
//     courseTitle: plain.courseTitle,
//     studentName: plain.studentName || null,
//     thumbnail: plain.thumbnail || null,
//     gallery: Array.isArray(plain.gallery) ? plain.gallery : [],
//     technologies: Array.isArray(plain.technologies) ? plain.technologies : [],
//     tags: Array.isArray(plain.tags) ? plain.tags : [],
//     githubUrl: plain.githubUrl || "",
//     liveUrl: plain.liveUrl || "",
//     figmaUrl: plain.figmaUrl || "",
//     behanceUrl: plain.behanceUrl || "",
//     videoUrl: plain.videoUrl || "",
//     driveUrl: plain.driveUrl || "",
//     featured: Boolean(plain.featured),
//     publishedAt: plain.publishedAt,
//     createdAt: plain.createdAt,
//   };
// };

// const getPublicPortfolios = async (query) => {
//   const { course, category, search, page = 1, limit = 12 } = query;

//   const filter = { status: "published" };

//   if (course) {
//     filter.course = course;
//   } else if (category && category !== "All") {
//     filter.category = category;
//   }

//   if (search) {
//     filter.$or = [
//       { title: { $regex: search, $options: "i" } },
//       { description: { $regex: search, $options: "i" } },
//     ];
//   }

//   const skip = (page - 1) * limit;

//   const [portfolios, total] = await Promise.all([
//     Portfolio.find(filter)
//       .select("title slug description category courseTitle studentName thumbnail gallery technologies tags githubUrl liveUrl figmaUrl behanceUrl videoUrl driveUrl featured publishedAt createdAt")
//       .sort({ featured: -1, publishedAt: -1 })
//       .skip(skip)
//       .limit(Number(limit))
//       .lean(),

//     Portfolio.countDocuments(filter),
//   ]);

//   return {
//     portfolios: portfolios.map(sanitizePublicPortfolio),
//     pagination: {
//       total,
//       page: Number(page),
//       limit: Number(limit),
//       pages: Math.ceil(total / limit),
//     },
//   };
// };

const getPublicPortfolios = async (query) => {
  const { course, category, search, page = 1, limit = 12 } = query;

  const filter = { status: "published" };

  if (course) {
    filter.course = course;
  } else if (category && category !== "All") {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [portfolios, total] = await Promise.all([
    Portfolio.find(filter)
      .select(
        "title slug description category courseTitle studentName student thumbnail gallery technologies tags githubUrl liveUrl figmaUrl behanceUrl videoUrl driveUrl featured publishedAt createdAt"
      )
      .populate("student", "fullName") // ← YEH LINE ADD KARO
      .sort({ featured: -1, publishedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),

    Portfolio.countDocuments(filter),
  ]);

  return {
    portfolios: portfolios.map(sanitizePublicPortfolio),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
};

const sanitizePublicPortfolio = (portfolio) => {
  if (!portfolio) return null;
  const plain = portfolio.toObject ? portfolio.toObject() : portfolio;

  // Backend hi final student name resolve kar dega — frontend ko guess nahi karna padega
  const resolvedStudentName =
    plain.studentName ||          // external student ka stored naam
    plain.student?.fullName ||    // populated real-student ka naam
    "deepScode Student";

  return {
    _id: plain._id,
    title: plain.title,
    slug: plain.slug,
    description: plain.description,
    category: plain.category,
    courseTitle: plain.courseTitle,
    studentName: resolvedStudentName, // ← ab hamesha sahi naam aayega
    thumbnail: plain.thumbnail || null,
    gallery: Array.isArray(plain.gallery) ? plain.gallery : [],
    technologies: Array.isArray(plain.technologies) ? plain.technologies : [],
    tags: Array.isArray(plain.tags) ? plain.tags : [],
    githubUrl: plain.githubUrl || "",
    liveUrl: plain.liveUrl || "",
    figmaUrl: plain.figmaUrl || "",
    behanceUrl: plain.behanceUrl || "",
    videoUrl: plain.videoUrl || "",
    driveUrl: plain.driveUrl || "",
    featured: Boolean(plain.featured),
    publishedAt: plain.publishedAt,
    createdAt: plain.createdAt,
  };
};


module.exports = {
  createPortfolio,

  getStudentCourse,

  getMyPortfolio,

  updatePortfolio,

  deletePortfolio,

  submitPortfolio,
  getPublicPortfolios,
  sanitizePublicPortfolio,
};

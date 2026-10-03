const Career = require("../models/Career");
const CareerApplication = require("../models/CareerApplication");


const applyForCareer = async (careerId, payload, resume, ip) => {
  // Check Career Exists
  const career = await Career.findOne({
    _id: careerId,
    status: "Published",
    isDeleted: false,
  });

  if (!career) {
    throw new Error("Career not found");
  }

  // Duplicate Application Check
  const alreadyApplied = await CareerApplication.findOne({
    career: careerId,
    email: payload.email.toLowerCase(),
    isDeleted: false,
  });

  if (alreadyApplied) {
    throw new Error("You have already applied for this position.");
  }

  const application = await CareerApplication.create({
    ...payload,

    career: careerId,

    resume: resume
      ? {
          url: resume.path || resume.secure_url || "",
          publicId: resume.filename || "",
          originalName: resume.originalname || "",
          size: resume.size || 0,
        }
      : undefined,

    createdByIP: ip,
  });

  return application;
};



const getApplications = async ({
  page = 1,
  limit = 10,
  status,
  search,
}) => {
  page = Number(page);
  limit = Number(limit);

  const filter = {
    isDeleted: false,
  };

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      {
        firstName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        lastName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    CareerApplication.find(filter)
      .populate("career", "title location")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    CareerApplication.countDocuments(filter),
  ]);

  return {
    data: applications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};



const getApplicationById = async (id) => {
  return CareerApplication.findOne({
    _id: id,
    isDeleted: false,
  }).populate("career");
};



const updateApplicationStatus = async (id, status, remarks) => {
  const application = await CareerApplication.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  application.status = status;

  if (remarks) {
    application.adminRemarks = remarks;
  }

  await application.save();

  return application;
};



const deleteApplication = async (id) => {
  const application = await CareerApplication.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!application) {
    throw new Error("Application not found");
  }

  application.isDeleted = true;

  await application.save();

  return true;
};


const getDashboardStats = async () => {
  const [
    total,
    applied,
    shortlisted,
    interviewed,
    selected,
    rejected,
  ] = await Promise.all([
    CareerApplication.countDocuments({
      isDeleted: false,
    }),

    CareerApplication.countDocuments({
      status: "Applied",
      isDeleted: false,
    }),

    CareerApplication.countDocuments({
      status: "Shortlisted",
      isDeleted: false,
    }),

    CareerApplication.countDocuments({
      status: "Interviewed",
      isDeleted: false,
    }),

    CareerApplication.countDocuments({
      status: "Selected",
      isDeleted: false,
    }),

    CareerApplication.countDocuments({
      status: "Rejected",
      isDeleted: false,
    }),
  ]);

  return {
    total,
    applied,
    shortlisted,
    interviewed,
    selected,
    rejected,
  };
};

module.exports = {
  applyForCareer,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
  getDashboardStats,
};
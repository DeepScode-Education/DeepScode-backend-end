const mongoose = require("mongoose");

const careerApplicationSchema = new mongoose.Schema(
  {
    career: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Career",
      required: true,
      index: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    currentCompany: {
      type: String,
      trim: true,
      default: "",
    },

    experience: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentCTC: {
      type: Number,
      default: 0,
    },

    expectedCTC: {
      type: Number,
      default: 0,
    },

    noticePeriod: {
      type: String,
      default: "",
    },

    portfolio: {
      type: String,
      default: "",
    },

    linkedIn: {
      type: String,
      default: "",
    },

    github: {
      type: String,
      default: "",
    },

    coverLetter: {
      type: String,
      default: "",
    },

    resume: {
      url: {
        type: String,
        required: true,
      },

      publicId: {
        type: String,
        default: "",
      },

      originalName: {
        type: String,
        default: "",
      },

      size: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: [
        "Applied",
        "Shortlisted",
        "Interview Scheduled",
        "Interviewed",
        "Selected",
        "Rejected",
      ],
      default: "Applied",
      index: true,
    },

    interviewDate: Date,

    adminRemarks: {
      type: String,
      default: "",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdByIP: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

careerApplicationSchema.index({
  career: 1,
  status: 1,
});

careerApplicationSchema.index({
  createdAt: -1,
});

careerApplicationSchema.index({
  email: 1,
  phone: 1,
});

module.exports = mongoose.model(
  "CareerApplication",
  careerApplicationSchema
);
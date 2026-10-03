const mongoose = require("mongoose");

const careerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      enum: [
        "Engineering",
        "Design",
        "Marketing",
        "Sales",
        "HR",
        "Operations",
        "Finance",
        "Support",
        "Other",
      ],
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    workMode: {
      type: String,
      enum: ["Remote", "Hybrid", "Onsite"],
      default: "Onsite",
    },

    employmentType: {
      type: String,
      enum: [
        "Full Time",
        "Part Time",
        "Internship",
        "Contract",
        "Freelance",
      ],
      default: "Full Time",
    },

    experience: {
      min: {
        type: Number,
        default: 0,
      },
      max: {
        type: Number,
        default: 0,
      },
    },

    salary: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: "INR",
      },
    },

    openings: {
      type: Number,
      default: 1,
      min: 1,
    },

    description: {
      type: String,
      required: true,
    },

    responsibilities: [
      {
        type: String,
        trim: true,
      },
    ],

    requirements: [
      {
        type: String,
        trim: true,
      },
    ],

    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    benefits: [
      {
        type: String,
        trim: true,
      },
    ],

    applicationDeadline: Date,

    featured: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["Draft", "Published", "Closed"],
      default: "Draft",
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

careerSchema.index({
  title: "text",
  department: "text",
  location: "text",
});

careerSchema.index({
  slug: 1,
});

careerSchema.index({
  status: 1,
});

careerSchema.index({
  featured: 1,
});

careerSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model("Career", careerSchema);
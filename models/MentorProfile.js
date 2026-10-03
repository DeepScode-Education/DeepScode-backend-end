const mongoose = require("mongoose");

const careerMilestoneSchema = new mongoose.Schema(
  {
    period: { type: String, trim: true },
    title: { type: String, trim: true },
    company: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const featuredProjectSchema = new mongoose.Schema(
  {
    category: { type: String, trim: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, trim: true, default: "" },
    link: { type: String, trim: true, default: "" }, // for link-out cards (e.g. YouTube)
  },
  { _id: false }
);

const toolkitCategorySchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    tools: [{ type: String, trim: true }],
  },
  { _id: false }
);

const toolkitSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "The Toolkit" },
    subtitle: { type: String, trim: true, default: "" },
    categories: [toolkitCategorySchema],
  },
  { _id: false }
);

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    image: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, trim: true, default: "" },
    review: { type: String, trim: true },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    image: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, trim: true, default: "" },
    duration: { type: String, trim: true },
    students: { type: String, trim: true },
    price: { type: String, trim: true },
  },
  { _id: false }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    keywords: [{ type: String, trim: true }],
  },
  { _id: false }
);

const mentorProfileSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // ── Tab 1: Hero Section ──
    heroImage: { type: String, trim: true, default: "" },
    heroImagePublicId: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" }, // hero tagline
    experience: { type: String, trim: true, default: "" },  // e.g. "8+ Years"
    studentsCountLabel: { type: String, trim: true, default: "" },
    projects: { type: String, trim: true, default: "" },    // e.g. "150+"
    ratingLabel: { type: String, trim: true, default: "" },
    languages: { type: String, trim: true, default: "" },
    status: { type: String, trim: true, default: "Available" },

    // ── Tab 2: About & Expertise ──
    about: [{ type: String, trim: true }],
    expertise: [{ type: String, trim: true }],

    // ── Tab 3: Career Milestones ──
    careerMilestones: [careerMilestoneSchema],

    // ── Tab 4: Featured Projects ──
    featuredProjects: [featuredProjectSchema],
    artStationUrl: { type: String, trim: true, default: "" },

    // ── Tab 5: Toolkit ──
    toolkit: { type: toolkitSchema, default: undefined },

    // ── Tab 6: Testimonials ──
    testimonials: [testimonialSchema],

    // ── Tab 7: Courses ──
    courses: [courseSchema],

    // ── Tab 8: FAQ ──
    faqs: [faqSchema],

    // ── SEO ──
    seo: { type: seoSchema, default: () => ({}) },

    isPublished: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

mentorProfileSchema.index({ mentor: 1 }, { unique: true });
mentorProfileSchema.index({ isPublished: 1 });

module.exports = mongoose.model("MentorProfile", mentorProfileSchema);
// const mongoose = require("mongoose");
// const { CATEGORIES } = require("./Course");  

// const blogSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: 200,
//     },

//     slug: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//     },

//     shortDescription: {
//       type: String,
//       required: true,
//       maxlength: 500,
//     },

//     content: {
//       type: String,
//       required: true,
//     },

//     thumbnail: {
//       url: {
//         type: String,
//         default: "",
//       },
//       publicId: {
//         type: String,
//         default: "",
//       },
//     },

//     // category: {
//     //   type: String,
//     //   enum: [
//     //     "Design",
//     //     "Coding",
//     //     "Marketing",
//     //     "Data",
//     //   ],
//     //   required: true,
//     // },

//        category: {
//       type: String,
//       enum: {
//         values: CATEGORIES,
//         message: `Category must be one of: ${CATEGORIES.join(", ")}`,
//       },
//       required: true,
//     },

//     tags: [
//       {
//         type: String,
//         trim: true,
//       },
//     ],

//     featured: {
//       type: Boolean,
//       default: false,
//     },

//     status: {
//       type: String,
//       enum: ["Draft", "Published"],
//       default: "Draft",
//     },

//     readTime: {
//       type: Number,
//       default: 5,
//     },

//     views: {
//       type: Number,
//       default: 0,
//     },

//     seoTitle: {
//       type: String,
//       default: "",
//     },

//     metaDescription: {
//       type: String,
//       default: "",
//     },

//     isDeleted: {
//       type: Boolean,
//       default: false,
//     },

//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },

//     updatedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// blogSchema.index({
//   title: "text",
//   shortDescription: "text",
//   content: "text",
// });

// blogSchema.index({
//   slug: 1,
// });

// blogSchema.index({
//   category: 1,
// });

// blogSchema.index({
//   featured: 1,
// });

// blogSchema.index({
//   status: 1,
// });

// blogSchema.index({
//   createdAt: -1,
// });

// module.exports = mongoose.model("Blog", blogSchema);







const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    shortDescription: {
      type: String,
      required: true,
      maxlength: 500,
    },

    content: {
      type: String,
      required: true,
    },

    thumbnail: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    // NEW — blogs are now tagged to an actual Course document instead of a
    // hardcoded Design/Coding/Marketing/Data label. Nullable so existing
    // blogs created before this change keep working without migration.
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },

    // LEGACY — free-text category label. No longer settable directly from
    // the admin form; auto-snapshotted from course.category whenever a
    // course is linked (controllers/blog.controller.js). Kept purely for
    // backward compatibility with blogs where `course` is null, and so old
    // data/search/filtering never breaks.
    category: {
      type: String,
      trim: true,
      default: "",
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    featured: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["Draft", "Published"],
      default: "Draft",
    },

    readTime: {
      type: Number,
      default: 5,
    },

    views: {
      type: Number,
      default: 0,
    },

    seoTitle: {
      type: String,
      default: "",
    },

    metaDescription: {
      type: String,
      default: "",
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

blogSchema.index({
  title: "text",
  shortDescription: "text",
  content: "text",
});

blogSchema.index({ slug: 1 });
blogSchema.index({ course: 1 });   // NEW
blogSchema.index({ category: 1 }); // kept for legacy filtering
blogSchema.index({ featured: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Blog", blogSchema);
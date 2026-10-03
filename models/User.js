// // models/User.js
// //
// // UPDATED: mentor-specific extra fields add kiye (designation, company, bio,
// // photoUrl, expertise, linkedinUrl, instagramUrl, rating, studentsCount)
// // taaki Staff Management se bane mentors Teachers page pe bhi properly dikhe.

// const mongoose = require("mongoose");

// require("./Branch");

// const ROLES = ["super_admin", "admin", "counsellor", "mentor", "accountant", "student"];
// const STAFF_ROLES = ["admin", "counsellor", "mentor", "accountant"];
// const STATUSES = ["pending", "approved", "rejected"];

// const userSchema = new mongoose.Schema(
//   {
//     fullName: {
//       type: String,
//       required: [true, "Full name is required"],
//       trim: true,
//       maxlength: [100, "Full name cannot exceed 100 characters"],
//     },

//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       unique: true,
//       lowercase: true,
//       trim: true,
//       match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
//     },

//     studentId: {
//       type: String,
//       unique: true,
//       sparse: true,
//       trim: true,
//     },

//     phone: { type: String, trim: true },
//     isPhoneVerified: { type: Boolean, default: false },

//     password: {
//       type: String,
//       required: [true, "Password is required"],
//       select: false,
//       minlength: [8, "Password hash too short — check hashing step"],
//     },

//     resetPasswordOtp: {
//       type: String,
//       default: null,
//       select: false,
//     },

//     resetPasswordOtpExpires: {
//       type: Date,
//       default: null,
//       select: false,
//     },
//     role: {
//       type: String,
//       enum: { values: ROLES, message: `Role must be one of: ${ROLES.join(", ")}` },
//       required: true,
//       default: "student",
//     },

//     status: {
//       type: String,
//       enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(", ")}` },
//       default: "pending",
//     },

//     branch: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Branch",
//       default: null,
//     },

//     isActive: { type: Boolean, default: true },
//     profileCompleted: { type: Boolean, default: false },
//     approvedAt: { type: Date, default: null },
//     lastLoginAt: { type: Date, default: null },

//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },

//     assignedCounsellor: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },

//     slug: {
//       type: String,
//       trim: true,
//       lowercase: true,
//       index: true,
//       sparse: true,
//       unique: true,
//     },


//     // Separate from assignedCounsellor (lead workflow) — governs fee collection visibility
// feeCollectionCounsellor: {
//   type: mongoose.Schema.Types.ObjectId,
//   ref: "User",
//   default: null,
// },

//     // ── Mentor-specific fields ────────────────────────────────────────────────
//     // Yeh fields sirf role: "mentor" ke liye meaningful hain.
//     // Staff Management se mentor create hone par yeh fields empty rahenge,
//     // lekin Teachers page pe admin in fields ko edit kar sakta hai.
//     designation: { type: String, trim: true, default: undefined },
//     company: { type: String, trim: true, default: undefined },
//     bio: { type: String, trim: true, default: undefined },
//     photoUrl: { type: String, trim: true, default: undefined },
//     expertise: [{ type: String, trim: true }],
//     linkedinUrl: { type: String, trim: true, default: undefined },
//     instagramUrl: { type: String, trim: true, default: undefined },
//     rating: { type: Number, default: 5, min: 1, max: 5 },
//     studentsCount: { type: Number, default: 0, min: 0 },
//   },
  
//   { timestamps: true }
// );

// // ─── Indexes ────────────────────────────────────────────────────────────────
// userSchema.index({ role: 1 });
// userSchema.index({ role: 1, status: 1 });

// // ─── Pre-save: staff accounts skip the approval workflow ────────────────────
// userSchema.pre("save", function () {
//   if (this.isNew && this.role !== "student") {
//     this.status = "approved";
//     this.approvedAt = this.approvedAt || new Date();
//   }
// });

// // ─── Helpers ────────────────────────────────────────────────────────────────
// userSchema.methods.toSafeJSON = function () {
//   const obj = this.toObject();
//   delete obj.password;
//   return obj;
// };

// userSchema.statics.ROLES = ROLES;
// userSchema.statics.STAFF_ROLES = STAFF_ROLES;

// module.exports = mongoose.model("User", userSchema);






// models/User.js
//
// UPDATED: mentor-specific extra fields add kiye (designation, company, bio,
// photoUrl, expertise, linkedinUrl, instagramUrl, rating, studentsCount)
// taaki Staff Management se bane mentors Teachers page pe bhi properly dikhe.

const mongoose = require("mongoose");

require("./Branch");

const ROLES = ["super_admin", "admin", "counsellor", "mentor", "accountant", "coordinator", "hr", "receptionist", "student"];
const STAFF_ROLES = ["admin", "counsellor", "mentor", "accountant", "coordinator", "hr", "receptionist"];
const STATUSES = ["pending", "approved", "rejected"];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },

    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    phone: { type: String, trim: true },
    isPhoneVerified: { type: Boolean, default: false },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      minlength: [8, "Password hash too short — check hashing step"],
    },

    resetPasswordOtp: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordOtpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: `Role must be one of: ${ROLES.join(", ")}` },
      required: true,
      default: "student",
    },

    status: {
      type: String,
      enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(", ")}` },
      default: "pending",
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    permissionOverrides: {
  type: [
    {
      permission: {
        type: String,
        required: true,
        trim: true,
      },
      allowed: {
        type: Boolean,
        required: true,
      },
    },
  ],
  default: [],
},

    isActive: { type: Boolean, default: true },
    profileCompleted: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedCounsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      sparse: true,
      unique: true,
    },


    // Separate from assignedCounsellor (lead workflow) — governs fee collection visibility
feeCollectionCounsellor: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},

    // ── Mentor-specific fields ────────────────────────────────────────────────
    // Yeh fields sirf role: "mentor" ke liye meaningful hain.
    // Staff Management se mentor create hone par yeh fields empty rahenge,
    // lekin Teachers page pe admin in fields ko edit kar sakta hai.
    designation: { type: String, trim: true, default: undefined },
    company: { type: String, trim: true, default: undefined },
    bio: { type: String, trim: true, default: undefined },
    photoUrl: { type: String, trim: true, default: undefined },
    expertise: [{ type: String, trim: true }],
    linkedinUrl: { type: String, trim: true, default: undefined },
    instagramUrl: { type: String, trim: true, default: undefined },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    studentsCount: { type: Number, default: 0, min: 0 },
  },
  
  { timestamps: true }
);

// ─── Indexes ────────────────────────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ role: 1, status: 1 });

// ─── Pre-save: staff accounts skip the approval workflow ────────────────────
userSchema.pre("save", function () {
  if (this.isNew && this.role !== "student") {
    this.status = "approved";
    this.approvedAt = this.approvedAt || new Date();
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────
userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.statics.ROLES = ROLES;
userSchema.statics.STAFF_ROLES = STAFF_ROLES;

module.exports = mongoose.model("User", userSchema);


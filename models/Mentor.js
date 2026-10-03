const mongoose = require("mongoose");

const mentorSchema = new mongoose.Schema(
  {
    // ── Core identity ──────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    phone: { type: String, trim: true },

    // ── Profile details ────────────────────────────────────────────────────────
    designation: { type: String, trim: true },   // e.g. "Senior 3D Artist & Blender Expert"
    company: { type: String, trim: true },        // e.g. "DeepScode"
    bio: { type: String, trim: true },
    photoUrl: { type: String, trim: true },

    // ── Expertise tags ─────────────────────────────────────────────────────────
    // Stored as an array of strings, e.g. ["Blender", "3D Modeling", "Texturing"]
    expertise: [{ type: String, trim: true }],

    // ── Social links ───────────────────────────────────────────────────────────
    linkedinUrl: { type: String, trim: true },
    instagramUrl: { type: String, trim: true },

    // ── Stats shown on the card ────────────────────────────────────────────────
    rating: { type: Number, default: 5, min: 1, max: 5 },
    studentsCount: { type: Number, default: 0, min: 0 },

    // ── Legacy / backward-compat fields (keep so existing data isn't broken) ──
    specialization: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Mentor", mentorSchema);
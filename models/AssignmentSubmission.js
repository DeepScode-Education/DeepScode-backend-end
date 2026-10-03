const mongoose = require("mongoose");

const STATUSES = ["Submitted", "Under Review", "Approved", "Rejected"];

const fileSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    fileType: { type: String, enum: ["image", "pdf", "raw", "video"], default: "raw" },
    size: { type: Number, default: 0 },
}, { _id: false });

const assignmentSubmissionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 150 },
    description: { type: String, required: [true, "Description is required"], trim: true },
    category: { type: String, trim: true, default: "" },

    thumbnail: { type: String, trim: true, default: "" },
    files: { type: [fileSchema], default: [] },

    figmaLink: { type: String, trim: true, default: "" },
    githubLink: { type: String, trim: true, default: "" },
    liveLink: { type: String, trim: true, default: "" },
    driveLink: { type: String, trim: true, default: "" },

    notes: { type: String, trim: true, default: "" },

    status: {
        type: String,
        enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(", ")}` },
        default: "Submitted",
    },

    grade: { type: String, trim: true, default: "-" },
    feedback: { type: String, trim: true, default: "" },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },

    submittedDate: { type: Date, default: Date.now },
}, { timestamps: true });

assignmentSubmissionSchema.index({ student: 1, createdAt: -1 });
assignmentSubmissionSchema.index({ status: 1 });

module.exports = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
module.exports.STATUSES = STATUSES;
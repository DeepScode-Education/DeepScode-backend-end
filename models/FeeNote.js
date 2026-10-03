// models/FeeNote.js
//
// Unlimited notes per student fee. Append-only — never deleted.

const mongoose = require("mongoose");

const feeNoteSchema = new mongoose.Schema(
  {
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fee",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    note: {
      type: String,
      required: [true, "Note content is required"],
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

feeNoteSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("FeeNote", feeNoteSchema);
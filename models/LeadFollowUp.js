const mongoose = require("mongoose");

const leadFollowUpSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inquiry",
      required: true,
    },
    contactedBy: {
      type: String,
      required: true,
      trim: true,
    },
    communicationType: {
      type: String,
      enum: ["call", "whatsapp", "email", "meeting"],
      required: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
    nextFollowUpDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeadFollowUp", leadFollowUpSchema);
const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Branch code is required"], // e.g. "MUM-N", "DEL-C"
      unique: true,
      uppercase: true,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    isHeadOffice: {
      type: Boolean,
      default: false,
    },
    counsellorCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Branch", branchSchema);
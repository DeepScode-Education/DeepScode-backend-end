const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    // Student / Person Name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Job Role
    role: {
      type: String,
      required: true,
      trim: true,
    },

    // Testimonial Description
    text: {
      type: String,
      required: true,
      trim: true,
    },

    // Cloudinary Image
    image: {
      url: {
        type: String,
        required: true,
      },

      publicId: {
        type: String,
        default: null,
      },
    },

    // Youtube / Video URL
   video:{
    url:{
        type:String,
        default:null,
    },

    publicId:{
        type:String,
        default:null,
    }
},

    // Star Rating
    rating: {
      type: Number,
      default: 5,
      min: 1,
      max: 5,
    },

    // Public visibility
    isActive: {
      type: Boolean,
      default: true,
    },

    // Carousel Order
    displayOrder: {
      type: Number,
      default: 0,
    },

    // Created Admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Updated Admin
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Testimonial", testimonialSchema);

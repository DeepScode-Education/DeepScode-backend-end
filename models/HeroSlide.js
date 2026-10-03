// const mongoose = require("mongoose");

// const heroSchema = new mongoose.Schema(
//   {
//     title: String,
//     subtitle: String,
//     image: String,
//     order: Number,
//     isActive: { type: Boolean, default: true },
//   },
//   { timestamps: true }
// );

// heroSchema.index({ isActive: 1, order: 1 });

// module.exports = mongoose.model("HeroSlide", heroSchema);




const mongoose = require("mongoose");

const heroSchema = new mongoose.Schema(
  {
    title: String,
    subtitle: String,
    image: String,
    // Cloudinary public_id for `image`. Required so we can call
    // cloudinary.uploader.destroy() on the old asset whenever it's replaced
    // or the slide is deleted — without this, every replace/delete leaks a
    // Cloudinary asset forever.
    imagePublicId: String,
    order: Number,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

heroSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model("HeroSlide", heroSchema);
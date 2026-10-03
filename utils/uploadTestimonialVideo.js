const cloudinary = require("../config/Cloudinary");

const uploadTestimonialVideo = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "deepScode/testimonials/videos",

        resource_type: "video",
      },

      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      },
    );

    stream.end(buffer);
  });
};

module.exports = uploadTestimonialVideo;

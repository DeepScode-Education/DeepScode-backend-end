const streamifier = require("streamifier");
const cloudinary = require("../config/Cloudinary");

const uploadResumeToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "career-resumes",

        resource_type: "raw",
      },

      (error, result) => {
        if (error) return reject(error);

        resolve(result);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

module.exports = uploadResumeToCloudinary;
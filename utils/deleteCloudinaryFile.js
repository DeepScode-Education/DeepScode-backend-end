const cloudinary = require("../config/Cloudinary");

const deleteCloudinaryFile = async (publicId) => {
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId);
};

module.exports = deleteCloudinaryFile;
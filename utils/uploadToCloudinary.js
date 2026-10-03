// const cloudinary = require("../config/Cloudinary");
// const streamifier = require("streamifier");

// const uploadToCloudinary = (fileBuffer, folder) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       {
//         folder,
//         resource_type: "image",

//         quality: "auto",
//         fetch_format: "auto",

//         transformation: [
//           {
//             width: 1600,
//             crop: "limit",
//             quality: "auto",
//             fetch_format: "auto",
//           },
//         ],
//       },
//       (error, result) => {
//         if (error) return reject(error);
//         resolve(result);
//       }
//     );

//     streamifier
//       .createReadStream(fileBuffer)
//       .pipe(uploadStream);
//   });
// };

// module.exports = uploadToCloudinary;



const cloudinary = require("../config/Cloudinary");
const streamifier = require("streamifier");

const uploadToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // Reject anything that isn't one of the formats the frontend is
        // built to serve (f_auto only negotiates AMONG formats Cloudinary
        // actually has to work with).
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        // Store a single reasonably-sized original. Do NOT bake q_auto /
        // fetch_format into the *stored* asset — those only make sense as
        // DELIVERY-time transformations (applied per-request based on the
        // requesting browser's Accept header), which is what
        // lib/image.ts's `f_auto` / `q_auto` already do on every rendered
        // URL. Setting them here was a no-op at best and could interfere
        // with correct per-browser negotiation at worst.
        transformation: [{ width: 1600, crop: "limit" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Best-effort delete of a Cloudinary asset. Never throws — a cleanup
 * failure should never fail the request that triggered it (the DB is the
 * source of truth; a stray orphaned asset is a cheap, recoverable problem,
 * a failed API response is not).
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error("Cloudinary destroy error:", err.message);
  }
};

module.exports = uploadToCloudinary;
module.exports.deleteFromCloudinary = deleteFromCloudinary;
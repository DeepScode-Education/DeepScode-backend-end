
const express = require("express");
const router = express.Router();
const multer = require("multer");

const { auth, isAdmin } = require("../middleware/auth.middleware");

const {
  getMentors,
  getMentorById,
  createMentor,
  updateMentor,
  deleteMentor,
  getMentorDetailBySlug,
} = require("../controllers/Mentor.controller");


// Photo upload — memory storage, images only, max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),

  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP images are allowed"), false);
    }
  },

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});


// Multer error handler
const handleUploadError = (err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err.message?.includes("Only")
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};


// ================= ROUTES =================


// Public Routes (No Token Required)
// Website visitors can view mentors
router.get("/profile/:slug", getMentorDetailBySlug);
router.get("/", getMentors);
router.get("/:id", getMentorById);


// Admin Routes (Token Required)
// Create mentor
router.post(
  "/",
  auth,
  isAdmin,
  upload.single("photo"),
  handleUploadError,
  createMentor
);


// Update mentor
router.put(
  "/:id",
  auth,
  isAdmin,
  upload.single("photo"),
  handleUploadError,
  updateMentor
);


// Delete mentor
router.delete(
  "/:id",
  auth,
  isAdmin,
  deleteMentor
);

module.exports = router;
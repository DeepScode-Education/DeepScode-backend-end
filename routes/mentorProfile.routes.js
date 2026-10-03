const express = require("express");
const router = express.Router();

const { auth, isAdmin } = require("../middleware/auth.middleware");
const upload = require("../middleware/Upload.middleware"); // existing generic image/video multer

const {
  createMentorProfile,
  getAllMentorProfiles,
  getMentorProfileById,
  updateMentorProfile,
  deleteMentorProfile,
  togglePublish,
  uploadMentorProfileImage,
} = require("../controllers/mentorProfile.controller");

// All routes here are admin-only.
router.use(auth, isAdmin);

router.post("/upload-image", upload.single("image"), uploadMentorProfileImage);

router.post("/", createMentorProfile);
router.get("/", getAllMentorProfiles);
router.get("/:id", getMentorProfileById);
router.put("/:id", updateMentorProfile);
router.delete("/:id", deleteMentorProfile);
router.patch("/:id/publish", togglePublish);

module.exports = router;
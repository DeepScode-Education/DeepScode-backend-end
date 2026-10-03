// // const express = require("express");
// // const router = express.Router();

// // const { auth, isMentor } = require("../middleware/auth.middleware");
// // const {
// //   getDashboard,
// //   getMyStudents,
// //   getMyCourses,
// //   getMyClasses,
// // } = require("../controllers/mentorPortal.controller");

// // // isMentor already allows mentor + admin + super_admin (auth.middleware.js)
// // router.use(auth, isMentor);

// // router.get("/dashboard", getDashboard);
// // router.get("/students", getMyStudents);
// // router.get("/courses", getMyCourses);
// // router.get("/classes", getMyClasses);

// // module.exports = router;



// const express = require("express");
// const router = express.Router();

// const { auth, isMentor } = require("../middleware/auth.middleware");
// const {
//   getDashboard,
//   getMyStudents,
//   getMyCourses,
//   getMyClasses,
//   getMyBatches,
//   getBatchStudents,
//    getBatchAttendance,  
//   markBatchAttendance, 
// } = require("../controllers/mentorPortal.controller");

// // isMentor already allows mentor + admin + super_admin (auth.middleware.js)
// router.use(auth, isMentor);

// router.get("/dashboard", getDashboard);
// router.get("/students", getMyStudents);
// router.get("/courses", getMyCourses);
// router.get("/classes", getMyClasses);
// router.get("/batches", getMyBatches);
// router.get("/batches/:id/students", getBatchStudents);
// router.get("/batches/:id/attendance", getBatchAttendance);
// router.post("/batches/:id/attendance", markBatchAttendance);

// module.exports = router;






const express = require("express");
const router = express.Router();

const { auth, isMentor } = require("../middleware/auth.middleware");
const {
  getDashboard,
  getMyStudents,
  getMyCourses,
  getMyClasses,
  getMyBatches,
  getBatchStudents,
  getBatchAttendance,
  markBatchAttendance,
} = require("../controllers/mentorPortal.controller");

// NEW — mentor video management (Google Drive-backed batch videos)
const {
  getBatchVideos,
  uploadBatchVideo,
  getVideoById,
  deleteVideo,
  streamVideo,
} = require("../controllers/mentorVideo.controller");
const { videoUpload, handleUploadError } = require("../middleware/videoUpload.middleware");

// isMentor already allows mentor + admin + super_admin (auth.middleware.js)
router.use(auth, isMentor);

router.get("/dashboard", getDashboard);
router.get("/students", getMyStudents);
router.get("/courses", getMyCourses);
router.get("/classes", getMyClasses);
router.get("/batches", getMyBatches);
router.get("/batches/:id/students", getBatchStudents);
router.get("/batches/:id/attendance", getBatchAttendance);
router.post("/batches/:id/attendance", markBatchAttendance);

// ── NEW: Batch video management ───────────────────────────────────────────────
router.get("/batches/:id/videos", getBatchVideos);
router.post("/batches/:id/videos", videoUpload, handleUploadError, uploadBatchVideo);

router.get("/videos/:videoId", getVideoById);
router.delete("/videos/:videoId", deleteVideo);
router.get("/videos/:videoId/stream", streamVideo);

module.exports = router;
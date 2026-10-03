// const express = require("express");

// const router = express.Router();

// const auth = require("../middleware/auth.middleware");

// const {
//   enrollCourse,
// } = require("../controllers/enrollment.controller");

// router.post(
//   "/:courseId", auth ,enrollCourse
// );

// module.exports = router;



const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { enrollCourse } = require("../controllers/enrollment.controller");

router.post("/:courseId", auth, enrollCourse);

module.exports = router;
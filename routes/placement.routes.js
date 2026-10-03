const express = require("express");
const router = express.Router();

const {
  createPlacementStudent,
  getPlacementStudents,
  getPlacementStudentById,
  updatePlacementStudent,
  deletePlacementStudent,
} = require("../controllers/placement.controller");

const { auth ,isAdmin  } = require("../middleware/auth.middleware");
const placementUpload = require("../middleware/placementUpload.middleware");


// Admin Create
router.post(
 "/",
 auth,
 isAdmin,
 placementUpload,
 createPlacementStudent
);


// Public Get All
router.get(
  "/",
  getPlacementStudents
);


// Public/Admin Single
router.get(
  "/:id",
  getPlacementStudentById
);


// Admin Update
router.put(
  "/:id",
  auth,
  isAdmin,
  updatePlacementStudent
);


// Admin Delete
router.delete(
  "/:id",
  auth,
  isAdmin,
  deletePlacementStudent
);


module.exports = router;
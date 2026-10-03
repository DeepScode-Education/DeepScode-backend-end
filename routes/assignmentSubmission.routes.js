const express = require("express");
const router = express.Router();

const { auth, isStudent, isMentor, isAdmin } = require("../middleware/auth.middleware");
const { assignmentUpload, handleUploadError } = require("../middleware/assignmentUpload.middleware");

const {
    createAssignment,
    getMyAssignments,
    getAllAssignments,
    getAssignmentById,
    updateAssignment,
    deleteAssignment,
    reviewAssignment,
} = require("../controllers/assignmentSubmission.controller");

router.use(auth);

router.post("/", isStudent, assignmentUpload, handleUploadError, createAssignment);
router.get("/mine", isStudent, getMyAssignments);
router.put("/:id", isStudent, assignmentUpload, handleUploadError, updateAssignment);
router.delete("/:id", isStudent, deleteAssignment);

router.get("/", isMentor, getAllAssignments);
router.patch("/:id/review", isMentor, reviewAssignment);

router.get("/:id", getAssignmentById);

router.delete("/admin/:id", isAdmin, deleteAssignment);

module.exports = router;
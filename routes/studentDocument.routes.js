const express = require("express");
const router = express.Router();

const { auth, isStudent } = require("../middleware/auth.middleware");
const { studentDocumentUpload, handleUploadError } = require("../middleware/studentDocumentUpload.middleware");
const { getMyDocuments, uploadDocument, deleteDocument } = require("../controllers/studentDocument.controller");

router.get("/", auth, isStudent, getMyDocuments);
router.post("/:type", auth, isStudent, studentDocumentUpload, handleUploadError, uploadDocument);
router.delete("/:type", auth, isStudent, deleteDocument);

module.exports = router;
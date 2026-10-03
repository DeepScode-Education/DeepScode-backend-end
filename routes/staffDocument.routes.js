const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  getStaffDocuments,
  getMyStaffDocuments,
  createStaffDocument,
  deleteStaffDocument,
} = require("../controllers/staffDocument.controller");

router.get("/me", auth, requirePermission("documents.view"), getMyStaffDocuments);

router.get("/:id", auth, requirePermission("documents.view"), getStaffDocuments);

router.post("/:id", auth, requirePermission("documents.upload"), createStaffDocument);

router.delete("/document/:id", auth, requirePermission("documents.delete"), deleteStaffDocument);

module.exports = router;

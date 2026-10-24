// const express = require("express");
// const router = express.Router();

// const { auth, isAdmin } = require("../middleware/auth.middleware");
// const {
//   getStudentDocuments,
//   verifyDocument,
//   requestActionOnDocument,
// } = require("../controllers/adminStudentDocument.controller");

// router.get("/:studentId/documents", auth, isAdmin, getStudentDocuments);
// router.patch("/:studentId/documents/:type/verify", auth, isAdmin, verifyDocument);
// router.patch("/:studentId/documents/:type/request-action", auth, isAdmin, requestActionOnDocument);

// module.exports = router;







const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  getStudentDocuments,
  verifyDocument,
  requestActionOnDocument,
} = require("../controllers/adminStudentDocument.controller");

router.get("/:studentId/documents", auth, requirePermission("documents.view"), getStudentDocuments);
router.patch("/:studentId/documents/:type/verify", auth, requirePermission("students.edit"), verifyDocument);
router.patch("/:studentId/documents/:type/request-action", auth, requirePermission("students.edit"), requestActionOnDocument);

module.exports = router;
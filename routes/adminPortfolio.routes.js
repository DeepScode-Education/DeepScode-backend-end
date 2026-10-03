const express = require("express");

const router = express.Router();

const {
  getAllPortfolios,
  getPortfolioById,
  updatePortfolio,
  deletePortfolio,
  approvePortfolio,
  rejectPortfolio,
  requestChanges,
  publishPortfolio,
  unpublishPortfolio,
  toggleFeatured,
  createExternalPortfolio,
} = require("../controllers/adminPortfolio.controller");

const { auth, isAdmin } = require("../middleware/auth.middleware");

// NEW — reuse the same Cloudinary upload plumbing the student portfolio flow
// already uses (middleware + controller are generic, not student-specific).
const uploadPortfolio = require("../middleware/uploadPortfolio.middleware");
const { uploadPortfolioImage } = require("../controllers/portfolioUpload.controller");

/*
|--------------------------------------------------------------------------
| Admin Portfolio Routes
|--------------------------------------------------------------------------
*/

router.post("/external", auth, isAdmin, createExternalPortfolio);

// NEW — Admin thumbnail/gallery image upload
// POST /api/admin/portfolio/upload  (multipart/form-data, field name: "file")
router.post(
  "/upload",
  auth,
  isAdmin,
  uploadPortfolio.single("file"),
  uploadPortfolioImage,
);

// Get All Portfolio

router.get("/", auth, isAdmin, getAllPortfolios);

// Get Single Portfolio

router.get("/:id", auth, isAdmin, getPortfolioById);

// Update Portfolio

router.put("/:id", auth, isAdmin, updatePortfolio);

// Delete Portfolio

router.delete("/:id", auth, isAdmin, deletePortfolio);

// Approve Portfolio

router.patch("/:id/approve", auth, isAdmin, approvePortfolio);

// Reject Portfolio

router.patch("/:id/reject", auth, isAdmin, rejectPortfolio);

// Request Changes

router.patch("/:id/request-changes", auth, isAdmin, requestChanges);

// Publish Portfolio

router.patch("/:id/publish", auth, isAdmin, publishPortfolio);

// Unpublish Portfolio

router.patch("/:id/unpublish", auth, isAdmin, unpublishPortfolio);

// Feature / Unfeature

router.patch("/:id/feature", auth, isAdmin, toggleFeatured);

module.exports = router;
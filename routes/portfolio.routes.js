const express = require("express");

const router = express.Router();

const {
  createPortfolio,
  getMyPortfolio,
  updatePortfolio,
  deletePortfolio,
  submitPortfolio,
} = require("../controllers/portfolio.controller");

const { auth, isStudent } = require("../middleware/auth.middleware");

/*
|--------------------------------------------------------------------------
| Student Portfolio Routes
|--------------------------------------------------------------------------
*/

const uploadPortfolio = require("../middleware/uploadPortfolio.middleware");
const { uploadPortfolioImage } = require("../controllers/portfolioUpload.controller");

// Create Portfolio

router.post("/", auth, isStudent, createPortfolio);

// Get My Portfolio

router.get("/", auth, isStudent, getMyPortfolio);

// Update Portfolio

router.put("/:id", auth, isStudent, updatePortfolio);

// Delete Portfolio

router.delete("/:id", auth, isStudent, deletePortfolio);

// Submit For Review

router.patch("/:id/submit", auth, isStudent, submitPortfolio);

router.post("/upload", auth, isStudent, uploadPortfolio.single("file"), uploadPortfolioImage);


module.exports = router;

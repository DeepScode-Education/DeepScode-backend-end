const express = require("express");

const router = express.Router();

const {
  getPublishedBlogs,
  getFeaturedBlogs,
  getBlogBySlug,
} = require("../controllers/blog.controller");

// All Published Blogs
router.get("/", getPublishedBlogs);

// Featured Blogs
router.get("/featured", getFeaturedBlogs);

// Single Blog
router.get("/:slug", getBlogBySlug);

module.exports = router;
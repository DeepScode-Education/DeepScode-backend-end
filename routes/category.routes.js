const express = require("express");
const router = express.Router();

const { getCategories } = require("../controllers/category.controller");

// Public — used by both admin panel dropdowns and any future public filters
router.get("/", getCategories);

module.exports = router;
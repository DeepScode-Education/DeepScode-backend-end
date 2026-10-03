const { CATEGORIES } = require("../models/Course");

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: CATEGORIES,
    });
  } catch (error) {
    console.error("getCategories error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { getCategories };
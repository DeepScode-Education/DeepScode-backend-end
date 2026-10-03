// const express = require("express");
// const router = express.Router();

// const upload = require("../middleware/Upload.middleware"); // 

// const {
//   createHeroSlide,
//   getHeroSlides,
//   updateHeroSlide,
//   deleteHeroSlide,
// } = require("../controllers/hero.controller");

// // public
// router.get("/", getHeroSlides);

// // admin CRUD
// router.post("/", upload.single("image"), createHeroSlide);
// router.put("/:id", upload.single("image"), updateHeroSlide);
// router.delete("/:id", deleteHeroSlide);

// module.exports = router;





const express = require("express");
const router = express.Router();

const upload = require("../middleware/Upload.middleware");

const {
  createHeroSlide,
  getHeroSlides,
  updateHeroSlide,
  deleteHeroSlide,
} = require("../controllers/hero.controller");

// public
router.get("/", getHeroSlides);

// admin CRUD
router.post("/", upload.single("image"), createHeroSlide);
router.put("/:id", upload.single("image"), updateHeroSlide);

// Publish/draft toggle — this route did not exist before. useHeroSlides.ts's
// toggleActive() calls axios.patch(`/api/hero/${id}`, { isActive }), which
// was hitting a 404 (notFoundHandler) because there was no PATCH handler
// registered at all. It reuses updateHeroSlide, which already handles a
// partial JSON body fine — no multer needed since this call never sends a file.
router.patch("/:id", updateHeroSlide);

router.delete("/:id", deleteHeroSlide);

module.exports = router;
const express = require("express");

const router = express.Router();

const upload = require("../middleware/Upload.middleware");

const { auth, isAdmin } = require("../middleware/auth.middleware");

const {
  createTestimonial,

  getAdminTestimonials,

  getPublicTestimonials,

  getTestimonialById,

  updateTestimonial,

  deleteTestimonial,

  updateTestimonialStatus,

  updateTestimonialOrder,
} = require("../controllers/testimonial.controller");

/*
|--------------------------------------------------------------------------
| PUBLIC
|--------------------------------------------------------------------------
*/

// Website slider

router.get(
  "/",

  getPublicTestimonials,
);

/*
|--------------------------------------------------------------------------
| ADMIN
|--------------------------------------------------------------------------
*/

router.get(
  "/admin",

  auth,

  isAdmin,

  getAdminTestimonials,
);

router.get(
  "/:id",

  auth,

  isAdmin,

  getTestimonialById,
);

// CREATE

router.post(
  "/",

  auth,

  isAdmin,

  upload.fields([
    {
      name: "image",

      maxCount: 1,
    },

    {
      name: "video",

      maxCount: 1,
    },
  ]),

  createTestimonial,
);

// UPDATE

router.put(
  "/:id",

  auth,

  isAdmin,

  upload.fields([
    {
      name: "image",

      maxCount: 1,
    },

    {
      name: "video",

      maxCount: 1,
    },
  ]),

  updateTestimonial,
);

// DELETE

router.delete(
  "/:id",

  auth,

  isAdmin,

  deleteTestimonial,
);

// STATUS

router.patch(
  "/:id/status",

  auth,

  isAdmin,

  updateTestimonialStatus,
);

// ORDER

router.patch(
  "/:id/order",

  auth,

  isAdmin,

  updateTestimonialOrder,
);

module.exports = router;

const Testimonial = require("../models/Testimonial");

/*
|--------------------------------------------------------------------------
| CREATE TESTIMONIAL
|--------------------------------------------------------------------------
*/

const createTestimonial = async (data, userId) => {
  const testimonial = await Testimonial.create({
    ...data,

    createdBy: userId,
  });

  return testimonial;
};

/*
|--------------------------------------------------------------------------
| ADMIN GET ALL
|--------------------------------------------------------------------------
*/

const getAdminTestimonials = async (query) => {
  const {
    page = 1,

    limit = 10,

    search,
  } = query;

  const filter = {};

  if (search?.trim()) {
    filter.$or = [
      {
        name: {
          $regex: search.trim(),

          $options: "i",
        },
      },

      {
        role: {
          $regex: search.trim(),

          $options: "i",
        },
      },
    ];
  }

  const pageNumber = Math.max(1, Number(page));

  const limitNumber = Math.min(50, Number(limit));

  const skip = (pageNumber - 1) * limitNumber;

  const [testimonials, total] = await Promise.all([
    Testimonial.find(filter)

      .sort({
        displayOrder: 1,

        createdAt: -1,
      })

      .skip(skip)

      .limit(limitNumber)

      .populate("createdBy", "fullName email"),

    Testimonial.countDocuments(filter),
  ]);

  return {
    data: testimonials,

    pagination: {
      total,

      page: pageNumber,

      limit: limitNumber,

      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

/*
|--------------------------------------------------------------------------
| PUBLIC TESTIMONIALS
|--------------------------------------------------------------------------
*/

const getPublicTestimonials = async () => {
  return await Testimonial.find({
    isActive: true,
  })

    .sort({
      displayOrder: 1,

      createdAt: -1,
    })

    .lean();
};

/*
|--------------------------------------------------------------------------
| GET BY ID
|--------------------------------------------------------------------------
*/

const getTestimonialById = async (id) => {
  return await Testimonial.findById(id)

    .populate("createdBy", "fullName email");
};

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

const updateTestimonial = async (id, data, userId) => {
  return await Testimonial.findByIdAndUpdate(
    id,

    {
      $set: {
        ...data,

        updatedBy: userId,
      },
    },

    {
      new: true,

      runValidators: true,
    },
  );
};

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

const deleteTestimonial = async (id) => {
  return await Testimonial.findByIdAndDelete(id);
};

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

const updateStatus = async (id, status) => {
  return await Testimonial.findByIdAndUpdate(
    id,

    {
      isActive: status,
    },

    {
      new: true,
    },
  );
};

/*
|--------------------------------------------------------------------------
| ORDER
|--------------------------------------------------------------------------
*/

const updateOrder = async (id, order) => {
  return await Testimonial.findByIdAndUpdate(
    id,

    {
      displayOrder: order,
    },

    {
      new: true,
    },
  );
};

module.exports = {
  createTestimonial,

  getAdminTestimonials,

  getPublicTestimonials,

  getTestimonialById,

  updateTestimonial,

  deleteTestimonial,

  updateStatus,

  updateOrder,
};

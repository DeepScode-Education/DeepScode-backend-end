// const slugify = require("slugify");
// const Blog = require("../models/Blog");

// /* -------------------------------------------------------------------------- */
// /*                         Generate Unique Slug                               */
// /* -------------------------------------------------------------------------- */

// const generateUniqueSlug = async (title, excludeId = null) => {
//   let slug = slugify(title, {
//     lower: true,
//     strict: true,
//     trim: true,
//   });

//   let finalSlug = slug;
//   let count = 1;

//   while (true) {
//     const existing = await Blog.findOne({
//       slug: finalSlug,
//       ...(excludeId && { _id: { $ne: excludeId } }),
//     });

//     if (!existing) break;

//     finalSlug = `${slug}-${count++}`;
//   }

//   return finalSlug;
// };

// /* -------------------------------------------------------------------------- */
// /*                              Create Blog                                   */
// /* -------------------------------------------------------------------------- */

// const createBlog = async (payload, userId) => {
//   const slug = await generateUniqueSlug(payload.title);

//   const blog = await Blog.create({
//     ...payload,
//     slug,
//     createdBy: userId,
//     updatedBy: userId,
//   });

//   return blog;
// };

// /* -------------------------------------------------------------------------- */
// /*                              Update Blog                                   */
// /* -------------------------------------------------------------------------- */

// const updateBlog = async (blogId, payload, userId) => {
//   const blog = await Blog.findOne({
//     _id: blogId,
//     isDeleted: false,
//   });

//   if (!blog) {
//     throw new Error("Blog not found");
//   }

//   if (
//     payload.title &&
//     payload.title.trim() !== blog.title
//   ) {
//     payload.slug = await generateUniqueSlug(
//       payload.title,
//       blogId
//     );
//   }

//   Object.assign(blog, payload);

//   blog.updatedBy = userId;

//   await blog.save();

//   return blog;
// };

// /* -------------------------------------------------------------------------- */
// /*                              Soft Delete                                   */
// /* -------------------------------------------------------------------------- */

// const deleteBlog = async (blogId) => {
//   const blog = await Blog.findOne({
//     _id: blogId,
//     isDeleted: false,
//   });

//   if (!blog) {
//     throw new Error("Blog not found");
//   }

//   blog.isDeleted = true;

//   await blog.save();

//   return blog;
// };

// /* -------------------------------------------------------------------------- */
// /*                              Get By ID                                     */
// /* -------------------------------------------------------------------------- */

// const getBlogById = async (blogId) => {
//   return Blog.findOne({
//     _id: blogId,
//     isDeleted: false,
//   })
//     .populate("createdBy", "fullName email")
//     .populate("updatedBy", "fullName email");
// };

// /* -------------------------------------------------------------------------- */
// /*                              Admin Blogs                                   */
// /* -------------------------------------------------------------------------- */

// const getAdminBlogs = async ({
//   page = 1,
//   limit = 10,
//   search = "",
//   category,
//   status,
//   featured,
// }) => {

//   page = Number(page);
//   limit = Number(limit);

//   const filter = {
//     isDeleted: false,
//   };

//   if (search) {
//     filter.$text = {
//       $search: search,
//     };
//   }

//   if (category) {
//     filter.category = category;
//   }

//   if (status) {
//     filter.status = status;
//   }

//   if (featured !== undefined) {
//     filter.featured = featured === "true";
//   }

//   const skip = (page - 1) * limit;

//   const [data, total] = await Promise.all([
//     Blog.find(filter)
//       .sort({
//         featured: -1,
//         createdAt: -1,
//       })
//       .skip(skip)
//       .limit(limit),

//     Blog.countDocuments(filter),
//   ]);

//   return {
//     total,
//     page,
//     limit,
//     totalPages: Math.ceil(total / limit),
//     data,
//   };
// };

// /* -------------------------------------------------------------------------- */
// /*                           Public Blogs                                     */
// /* -------------------------------------------------------------------------- */

// const getPublishedBlogs = async ({
//   category,
//   search,
// }) => {

//   const filter = {
//     status: "Published",
//     isDeleted: false,
//   };

//   if (category) {
//     filter.category = category;
//   }

//   if (search) {
//     filter.$text = {
//       $search: search,
//     };
//   }

//   return Blog.find(filter)
//     .sort({
//       featured: -1,
//       createdAt: -1,
//     })
//     .select("-isDeleted");
// };

// /* -------------------------------------------------------------------------- */
// /*                           Featured Blogs                                   */
// /* -------------------------------------------------------------------------- */

// const getFeaturedBlogs = async () => {
//   return Blog.find({
//     featured: true,
//     status: "Published",
//     isDeleted: false,
//   })
//     .sort({
//       createdAt: -1,
//     })
//     .limit(6);
// };

// /* -------------------------------------------------------------------------- */
// /*                             Get By Slug                                    */
// /* -------------------------------------------------------------------------- */

// const getBlogBySlug = async (slug) => {
//   return Blog.findOne({
//     slug,
//     status: "Published",
//     isDeleted: false,
//   });
// };

// /* -------------------------------------------------------------------------- */
// /*                            Update Status                                   */
// /* -------------------------------------------------------------------------- */

// const updateStatus = async (
//   blogId,
//   status
// ) => {

//   return Blog.findByIdAndUpdate(
//     blogId,
//     {
//       status,
//     },
//     {
//       new: true,
//     }
//   );
// };

// /* -------------------------------------------------------------------------- */
// /*                           Increment Views                                  */
// /* -------------------------------------------------------------------------- */

// const incrementViews = async (blogId) => {

//   return Blog.findByIdAndUpdate(
//     blogId,
//     {
//       $inc: {
//         views: 1,
//       },
//     },
//     {
//       new: true,
//     }
//   );
// };

// module.exports = {
//   createBlog,
//   updateBlog,
//   deleteBlog,
//   getBlogById,
//   getAdminBlogs,
//   getPublishedBlogs,
//   getFeaturedBlogs,
//   getBlogBySlug,
//   updateStatus,
//   incrementViews,
// };










const slugify = require("slugify");
const Blog = require("../models/Blog");

const COURSE_POPULATE_FIELDS = "title slug category";

/* -------------------------------------------------------------------------- */
/*                         Generate Unique Slug                               */
/* -------------------------------------------------------------------------- */

const generateUniqueSlug = async (title, excludeId = null) => {
  let slug = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });

  let finalSlug = slug;
  let count = 1;

  while (true) {
    const existing = await Blog.findOne({
      slug: finalSlug,
      ...(excludeId && { _id: { $ne: excludeId } }),
    });

    if (!existing) break;

    finalSlug = `${slug}-${count++}`;
  }

  return finalSlug;
};

/* -------------------------------------------------------------------------- */
/*                              Create Blog                                   */
/* -------------------------------------------------------------------------- */

const createBlog = async (payload, userId) => {
  const slug = await generateUniqueSlug(payload.title);

  const blog = await Blog.create({
    ...payload,
    slug,
    createdBy: userId,
    updatedBy: userId,
  });

  return Blog.findById(blog._id).populate("course", COURSE_POPULATE_FIELDS);
};

/* -------------------------------------------------------------------------- */
/*                              Update Blog                                   */
/* -------------------------------------------------------------------------- */

const updateBlog = async (blogId, payload, userId) => {
  const blog = await Blog.findOne({
    _id: blogId,
    isDeleted: false,
  });

  if (!blog) {
    throw new Error("Blog not found");
  }

  if (
    payload.title &&
    payload.title.trim() !== blog.title
  ) {
    payload.slug = await generateUniqueSlug(
      payload.title,
      blogId
    );
  }

  Object.assign(blog, payload);

  blog.updatedBy = userId;

  await blog.save();

  return Blog.findById(blog._id).populate("course", COURSE_POPULATE_FIELDS);
};

/* -------------------------------------------------------------------------- */
/*                              Soft Delete                                   */
/* -------------------------------------------------------------------------- */

const deleteBlog = async (blogId) => {
  const blog = await Blog.findOne({
    _id: blogId,
    isDeleted: false,
  });

  if (!blog) {
    throw new Error("Blog not found");
  }

  blog.isDeleted = true;

  await blog.save();

  return blog;
};

/* -------------------------------------------------------------------------- */
/*                              Get By ID                                     */
/* -------------------------------------------------------------------------- */

const getBlogById = async (blogId) => {
  return Blog.findOne({
    _id: blogId,
    isDeleted: false,
  })
    .populate("course", COURSE_POPULATE_FIELDS)
    .populate("createdBy", "fullName email")
    .populate("updatedBy", "fullName email");
};

/* -------------------------------------------------------------------------- */
/*                              Admin Blogs                                   */
/* -------------------------------------------------------------------------- */

const getAdminBlogs = async ({
  page = 1,
  limit = 10,
  search = "",
  category,
  course, // NEW
  status,
  featured,
}) => {

  page = Number(page);
  limit = Number(limit);

  const filter = {
    isDeleted: false,
  };

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  // NEW — filter by actual Course reference. `category` is kept as a
  // fallback so any old admin bookmark/link using ?category= still works
  // against legacy (unmigrated) blogs.
  if (course) {
    filter.course = course;
  } else if (category) {
    filter.category = category;
  }

  if (status) {
    filter.status = status;
  }

  if (featured !== undefined) {
    filter.featured = featured === "true";
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Blog.find(filter)
      .populate("course", COURSE_POPULATE_FIELDS)
      .sort({
        featured: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    Blog.countDocuments(filter),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
  };
};

/* -------------------------------------------------------------------------- */
/*                           Public Blogs                                     */
/* -------------------------------------------------------------------------- */

const getPublishedBlogs = async ({
  category,
  course, // NEW
  search,
}) => {

  const filter = {
    status: "Published",
    isDeleted: false,
  };

  // NEW — course-based filtering is now the primary mechanism. `category`
  // stays as a fallback for legacy blogs that have no `course` set yet.
  if (course) {
    filter.course = course;
  } else if (category && category !== "All") {
    filter.category = category;
  }

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  return Blog.find(filter)
    .populate("course", COURSE_POPULATE_FIELDS)
    .sort({
      featured: -1,
      createdAt: -1,
    })
    .select("-isDeleted");
};

/* -------------------------------------------------------------------------- */
/*                           Featured Blogs                                   */
/* -------------------------------------------------------------------------- */

const getFeaturedBlogs = async () => {
  return Blog.find({
    featured: true,
    status: "Published",
    isDeleted: false,
  })
    .populate("course", COURSE_POPULATE_FIELDS)
    .sort({
      createdAt: -1,
    })
    .limit(6);
};

/* -------------------------------------------------------------------------- */
/*                             Get By Slug                                    */
/* -------------------------------------------------------------------------- */

const getBlogBySlug = async (slug) => {
  return Blog.findOne({
    slug,
    status: "Published",
    isDeleted: false,
  }).populate("course", COURSE_POPULATE_FIELDS);
};

/* -------------------------------------------------------------------------- */
/*                            Update Status                                   */
/* -------------------------------------------------------------------------- */

const updateStatus = async (
  blogId,
  status
) => {

  return Blog.findByIdAndUpdate(
    blogId,
    {
      status,
    },
    {
      new: true,
    }
  ).populate("course", COURSE_POPULATE_FIELDS);
};

/* -------------------------------------------------------------------------- */
/*                           Increment Views                                  */
/* -------------------------------------------------------------------------- */

const incrementViews = async (blogId) => {

  return Blog.findByIdAndUpdate(
    blogId,
    {
      $inc: {
        views: 1,
      },
    },
    {
      new: true,
    }
  );
};

module.exports = {
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogById,
  getAdminBlogs,
  getPublishedBlogs,
  getFeaturedBlogs,
  getBlogBySlug,
  updateStatus,
  incrementViews,
};
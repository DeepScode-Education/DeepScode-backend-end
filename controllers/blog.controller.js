// const blogService = require("../services/blog.service");

// const uploadBlogImage = require("../utils/uploadBlogImage");
// const deleteCloudinaryFile = require("../utils/deleteCloudinaryFile");

// /* -------------------------------------------------------------------------- */
// /*                               Create Blog                                  */
// /* -------------------------------------------------------------------------- */

// const createBlog = async (req, res, next) => {
//   try {
//     let thumbnail = {};

//     if (req.file) {
//       const uploaded = await uploadBlogImage(req.file);

//       thumbnail = {
//         url: uploaded.secure_url,
//         publicId: uploaded.public_id,
//       };
//     }

//     const blog = await blogService.createBlog(
//       {
//         ...req.body,
//         thumbnail,
//       },
//       req.user._id
//     );

//     return res.status(201).json({
//       success: true,
//       message: "Blog created successfully.",
//       data: blog,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                               Admin Blogs                                  */
// /* -------------------------------------------------------------------------- */

// const getAdminBlogs = async (req, res, next) => {
//   try {
//     const result = await blogService.getAdminBlogs(req.query);

//     return res.status(200).json({
//       success: true,
//       ...result,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                               Blog By Id                                   */
// /* -------------------------------------------------------------------------- */

// const getBlogById = async (req, res, next) => {
//   try {
//     const blog = await blogService.getBlogById(req.params.id);

//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: blog,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                              Update Blog                                   */
// /* -------------------------------------------------------------------------- */

// const updateBlog = async (req, res, next) => {
//   try {
//     const existing = await blogService.getBlogById(req.params.id);

//     if (!existing) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found.",
//       });
//     }

//     let thumbnail = existing.thumbnail;

//     if (req.file) {
//       if (existing.thumbnail?.publicId) {
//         await deleteCloudinaryFile(existing.thumbnail.publicId);
//       }

//       const uploaded = await uploadBlogImage(req.file);

//       thumbnail = {
//         url: uploaded.secure_url,
//         publicId: uploaded.public_id,
//       };
//     }

//     const blog = await blogService.updateBlog(
//       req.params.id,
//       {
//         ...req.body,
//         thumbnail,
//       },
//       req.user._id
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Blog updated successfully.",
//       data: blog,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                              Delete Blog                                   */
// /* -------------------------------------------------------------------------- */

// const deleteBlog = async (req, res, next) => {
//   try {
//     const blog = await blogService.getBlogById(req.params.id);

//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found.",
//       });
//     }

//     if (blog.thumbnail?.publicId) {
//       await deleteCloudinaryFile(blog.thumbnail.publicId);
//     }

//     await blogService.deleteBlog(req.params.id);

//     return res.status(200).json({
//       success: true,
//       message: "Blog deleted successfully.",
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                           Update Blog Status                               */
// /* -------------------------------------------------------------------------- */

// const updateBlogStatus = async (req, res, next) => {
//   try {
//     const blog = await blogService.updateStatus(
//       req.params.id,
//       req.body.status
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Blog status updated successfully.",
//       data: blog,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                          Public Blog Listing                               */
// /* -------------------------------------------------------------------------- */

// const getPublishedBlogs = async (req, res, next) => {
//   try {
//     const blogs = await blogService.getPublishedBlogs(req.query);

//     return res.status(200).json({
//       success: true,
//       count: blogs.length,
//       data: blogs,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                          Featured Blogs                                    */
// /* -------------------------------------------------------------------------- */

// const getFeaturedBlogs = async (req, res, next) => {
//   try {
//     const blogs = await blogService.getFeaturedBlogs();

//     return res.status(200).json({
//       success: true,
//       count: blogs.length,
//       data: blogs,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /* -------------------------------------------------------------------------- */
// /*                           Single Blog                                      */
// /* -------------------------------------------------------------------------- */

// const getBlogBySlug = async (req, res, next) => {
//   try {
//     const blog = await blogService.getBlogBySlug(req.params.slug);

//     if (!blog) {
//       return res.status(404).json({
//         success: false,
//         message: "Blog not found.",
//       });
//     }

//     await blogService.incrementViews(blog._id);

//     return res.status(200).json({
//       success: true,
//       data: blog,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = {
//   createBlog,
//   getAdminBlogs,
//   getBlogById,
//   updateBlog,
//   deleteBlog,
//   updateBlogStatus,
//   getPublishedBlogs,
//   getFeaturedBlogs,
//   getBlogBySlug,
// };









const blogService = require("../services/blog.service");
const Course = require("../models/Course"); // NEW

const uploadBlogImage = require("../utils/uploadBlogImage");
const deleteCloudinaryFile = require("../utils/deleteCloudinaryFile");

/* -------------------------------------------------------------------------- */
/*                               Create Blog                                  */
/* -------------------------------------------------------------------------- */

const createBlog = async (req, res, next) => {
  try {
    let thumbnail = {};

    if (req.file) {
      const uploaded = await uploadBlogImage(req.file);

      thumbnail = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      };
    }

    // NEW — resolve the selected course and snapshot its category onto the
    // legacy `category` field so old filtering/search never breaks.
    const courseDoc = await Course.findById(req.body.course).select("title category");
    if (!courseDoc) {
      return res.status(400).json({
        success: false,
        message: "Selected course does not exist.",
      });
    }

    const blog = await blogService.createBlog(
      {
        ...req.body,
        course: courseDoc._id,
        category: courseDoc.category,
        thumbnail,
      },
      req.user._id
    );

    return res.status(201).json({
      success: true,
      message: "Blog created successfully.",
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                               Admin Blogs                                  */
/* -------------------------------------------------------------------------- */

const getAdminBlogs = async (req, res, next) => {
  try {
    const result = await blogService.getAdminBlogs(req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                               Blog By Id                                   */
/* -------------------------------------------------------------------------- */

const getBlogById = async (req, res, next) => {
  try {
    const blog = await blogService.getBlogById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                              Update Blog                                   */
/* -------------------------------------------------------------------------- */

const updateBlog = async (req, res, next) => {
  try {
    const existing = await blogService.getBlogById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Blog not found.",
      });
    }

    let thumbnail = existing.thumbnail;

    if (req.file) {
      if (existing.thumbnail?.publicId) {
        await deleteCloudinaryFile(existing.thumbnail.publicId);
      }

      const uploaded = await uploadBlogImage(req.file);

      thumbnail = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      };
    }

    const updatePayload = {
      ...req.body,
      thumbnail,
    };

    // NEW — if a course is being changed, re-validate it and re-snapshot
    // the legacy category label. If no `course` was sent, the existing
    // course/category stay untouched.
    if (req.body.course) {
      const courseDoc = await Course.findById(req.body.course).select("title category");
      if (!courseDoc) {
        return res.status(400).json({
          success: false,
          message: "Selected course does not exist.",
        });
      }
      updatePayload.course = courseDoc._id;
      updatePayload.category = courseDoc.category;
    }

    const blog = await blogService.updateBlog(
      req.params.id,
      updatePayload,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully.",
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                              Delete Blog                                   */
/* -------------------------------------------------------------------------- */

const deleteBlog = async (req, res, next) => {
  try {
    const blog = await blogService.getBlogById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found.",
      });
    }

    if (blog.thumbnail?.publicId) {
      await deleteCloudinaryFile(blog.thumbnail.publicId);
    }

    await blogService.deleteBlog(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                           Update Blog Status                               */
/* -------------------------------------------------------------------------- */

const updateBlogStatus = async (req, res, next) => {
  try {
    const blog = await blogService.updateStatus(
      req.params.id,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Blog status updated successfully.",
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                          Public Blog Listing                               */
/* -------------------------------------------------------------------------- */

const getPublishedBlogs = async (req, res, next) => {
  try {
    const blogs = await blogService.getPublishedBlogs(req.query);

    return res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                          Featured Blogs                                    */
/* -------------------------------------------------------------------------- */

const getFeaturedBlogs = async (req, res, next) => {
  try {
    const blogs = await blogService.getFeaturedBlogs();

    return res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------------------------------------------------------------- */
/*                           Single Blog                                      */
/* -------------------------------------------------------------------------- */

const getBlogBySlug = async (req, res, next) => {
  try {
    const blog = await blogService.getBlogBySlug(req.params.slug);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found.",
      });
    }

    await blogService.incrementViews(blog._id);

    return res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBlog,
  getAdminBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  updateBlogStatus,
  getPublishedBlogs,
  getFeaturedBlogs,
  getBlogBySlug,
};
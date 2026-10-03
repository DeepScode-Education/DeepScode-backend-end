const PlacementStudent = require("../models/PlacementStudent");
const cloudinary = require("../config/Cloudinary");

// ===============================
// Cloudinary Upload Helper
// ===============================

const uploadToCloudinary = (
  buffer,
  folder,
  resourceType = "image",
  fileName = ""
) => {

  return new Promise((resolve, reject) => {

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,

        ...(resourceType === "raw" && {
          public_id: fileName
            .replace(/\.[^/.]+$/, "")
            .replace(/\s+/g, "_"),
        }),

      },

      (error, result) => {

        if(error){
          reject(error);
        }
        else{
          resolve(result);
        }

      }
    );


    stream.end(buffer);

  });

};

// ===============================
// Delete Cloudinary File
// ===============================

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.log("Cloudinary delete error:", error.message);
  }
};

// ===============================
// CREATE
// ===============================

const createPlacementStudent = async (req, res) => {
  try {
    let image = {};
    let offerLetter = {};

    // Image Upload

    if (req.files?.image) {
      const uploadedImage = await uploadToCloudinary(
        req.files.image[0].buffer,
        "deepScode/placements/images",
      );

      image = {
        url: uploadedImage.secure_url,
        publicId: uploadedImage.public_id,
      };
    }

    // PDF Upload

    if (req.files?.offerLetter) {
     const uploadedPdf =
await uploadToCloudinary(
  req.files.offerLetter[0].buffer,
  "deepScode/placements/offer-letter",
  "raw",
  req.files.offerLetter[0].originalname
);

      offerLetter = {
        url: uploadedPdf.secure_url,
        publicId: uploadedPdf.public_id,
      };
    }

    const student = await PlacementStudent.create({
      ...req.body,

      image,

      offerLetter,
    });

    return res.status(201).json({
      success: true,

      message: "Placement student created successfully",

      data: student,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,

      message: "Server Error",
    });
  }
};

// ===============================
// GET ALL
// ===============================

const getPlacementStudents = async (req, res) => {
  try {
    const students = await PlacementStudent.find().sort({
      displayOrder: 1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      count: students.length,

      data: students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: "Server Error",
    });
  }
};

// ===============================
// GET SINGLE
// ===============================

const getPlacementStudentById = async (req, res) => {
  try {
    const student = await PlacementStudent.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,

        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,

      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: "Server Error",
    });
  }
};

// ===============================
// UPDATE
// ===============================

const updatePlacementStudent = async (req, res) => {
  try {
    const existing = await PlacementStudent.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,

        message: "Student not found",
      });
    }

    let updateData = {
      ...req.body,
    };

    // New Image Upload

    if (req.files?.image) {
      // delete old image

      if (existing.image?.publicId) {
        await deleteFromCloudinary(existing.image.publicId);
      }

      const uploadedImage = await uploadToCloudinary(
        req.files.image[0].buffer,

        "deepScode/placements/images",
      );

      updateData.image = {
        url: uploadedImage.secure_url,

        publicId: uploadedImage.public_id,
      };
    }

    // New Offer Letter Upload

    if (req.files?.offerLetter) {
      if (existing.offerLetter?.publicId) {
        await deleteFromCloudinary(
          existing.offerLetter.publicId,

          "raw",
        );
      }

     const uploadedPdf = await uploadToCloudinary(
  req.files.offerLetter[0].buffer,

  "deepScode/placements/offer-letter",

  "raw",

  req.files.offerLetter[0].originalname
);

      updateData.offerLetter = {
        url: uploadedPdf.secure_url,

        publicId: uploadedPdf.public_id,
      };
    }

    const student = await PlacementStudent.findByIdAndUpdate(
      req.params.id,

      updateData,

      {
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      success: true,

      message: "Placement student updated successfully",

      data: student,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,

      message: "Server Error",
    });
  }
};

// ===============================
// DELETE
// ===============================

const deletePlacementStudent = async (req, res) => {
  try {
    const student = await PlacementStudent.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,

        message: "Student not found",
      });
    }

    // Delete Image

    if (student.image?.publicId) {
      await deleteFromCloudinary(student.image.publicId);
    }

    // Delete PDF

    if (student.offerLetter?.publicId) {
      await deleteFromCloudinary(
        student.offerLetter.publicId,

        "raw",
      );
    }

    await PlacementStudent.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,

      message: "Placement student deleted successfully",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,

      message: "Server Error",
    });
  }
};

module.exports = {
  createPlacementStudent,

  getPlacementStudents,

  getPlacementStudentById,

  updatePlacementStudent,

  deletePlacementStudent,
};

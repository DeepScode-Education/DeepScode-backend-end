
// const StudentProfile = require("../models/Studentprofile");
// const User = require("../models/User");
// const Course = require("../models/Course");
// const cloudinary = require("../config/Cloudinary");

// const uploadToCloudinary = (buffer, folder) => {
//   return new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder, resource_type: "image" },
//       (error, result) => {
//         if (error) return reject(error);
//         resolve(result);
//       }
//     );
//     stream.end(buffer);
//   });
// };

// // GET /api/student/profile
// const getMyProfile = async (req, res) => {
//   try {
//     const profile = await StudentProfile.findOne({ student: req.user.id }).populate(
//       "preferredCourse",
//       "title category"
//     );

//     return res.status(200).json({ success: true, data: profile });
//   } catch (error) {
//     console.error("getMyProfile error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // POST /api/student/profile  → first-time submission
// // PUT  /api/student/profile  → later edits
// const saveProfile = async (req, res) => {
//   try {
//     const {
//       fullName, dob, fatherName, mobileNumber,
//       address, city, state, pincode,
//       govtIdType, govtIdNumber, preferredCourse,
//     } = req.body;

//     const requiredFields = {
//       fullName, dob, fatherName, mobileNumber, address,
//       city, state, pincode, govtIdType, govtIdNumber, preferredCourse,
//     };
//     const missing = Object.entries(requiredFields)
//       .filter(([, v]) => !v)
//       .map(([k]) => k);

//     if (missing.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: `Missing required fields: ${missing.join(", ")}`,
//       });
//     }

//     const course = await Course.findById(preferredCourse);
//     if (!course) {
//       return res.status(400).json({ success: false, message: "Invalid course selected" });
//     }

//     const existingProfile = await StudentProfile.findOne({ student: req.user.id });

//     let govtIdImageUrl = existingProfile?.govtIdImageUrl;
//     let govtIdImagePublicId = existingProfile?.govtIdImagePublicId;

//     if (req.file) {
//       const uploaded = await uploadToCloudinary(req.file.buffer, "slate-academy/govt-ids");
//       govtIdImageUrl = uploaded.secure_url;
//       govtIdImagePublicId = uploaded.public_id;

//       if (existingProfile?.govtIdImagePublicId) {
//         cloudinary.uploader.destroy(existingProfile.govtIdImagePublicId).catch(() => {});
//       }
//     }

//     if (!govtIdImageUrl) {
//       return res.status(400).json({
//         success: false,
//         message: "Government ID image is required",
//       });
//     }

//     const profileData = {
//       student: req.user.id,
//       fullName, dob, fatherName, mobileNumber,
//       address, city, state, pincode,
//       govtIdType, govtIdNumber,
//       govtIdImageUrl, govtIdImagePublicId,
//       preferredCourse,
//     };

//     let profile;
//     if (existingProfile) {
//       profile = await StudentProfile.findOneAndUpdate(
//         { student: req.user.id },
//         profileData,
//         { new: true, runValidators: true }
//       );
//     } else {
//       profile = await StudentProfile.create(profileData);
//     }

//     await User.findByIdAndUpdate(req.user.id, { profileCompleted: true });

//     return res.status(existingProfile ? 200 : 201).json({
//       success: true,
//       message: existingProfile ? "Profile updated successfully" : "Profile completed successfully",
//       data: profile,
//     });
//   } catch (error) {
//     console.error("saveProfile error:", error);
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors).map((e) => e.message).join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// module.exports = { getMyProfile, saveProfile };


const StudentProfile = require("../models/Studentprofile");
const User = require("../models/User");
const cloudinary = require("../config/Cloudinary");

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// GET /api/student/profile
const getMyProfile = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ student: req.user.id });
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("getMyProfile error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// POST /api/student/profile  → first-time submission
// PUT  /api/student/profile  → later edits
const saveProfile = async (req, res) => {
  try {
    const {
      fullName, dob, fatherName, mobileNumber, gender,
      address, city, state, pincode,
      qualification, college, degree, passingYear,
      govtIdType, govtIdNumber,
    } = req.body;

    // Only these are truly required now — course/mentor are admin-assigned,
    // KYC (govtId) is optional.
    const requiredFields = {
      fullName, dob, mobileNumber, address, city, state, pincode,
    };
    const missing = Object.entries(requiredFields)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const existingProfile = await StudentProfile.findOne({ student: req.user.id });

    let govtIdImageUrl = existingProfile?.govtIdImageUrl;
    let govtIdImagePublicId = existingProfile?.govtIdImagePublicId;

    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, "deepScode/govt-ids");
      govtIdImageUrl = uploaded.secure_url;
      govtIdImagePublicId = uploaded.public_id;

      if (existingProfile?.govtIdImagePublicId) {
        cloudinary.uploader.destroy(existingProfile.govtIdImagePublicId).catch(() => {});
      }
    }

    const profileData = {
      student: req.user.id,
      fullName, dob, mobileNumber,
      address, city, state, pincode,
      fatherName: fatherName || existingProfile?.fatherName || "",
      gender: gender || existingProfile?.gender || null,
      qualification: qualification ?? existingProfile?.qualification ?? "",
      college: college ?? existingProfile?.college ?? "",
      degree: degree ?? existingProfile?.degree ?? "",
      passingYear: passingYear ?? existingProfile?.passingYear ?? "",
      govtIdType: govtIdType || existingProfile?.govtIdType || null,
      govtIdNumber: govtIdNumber ?? existingProfile?.govtIdNumber ?? "",
      govtIdImageUrl,
      govtIdImagePublicId,
    };

    let profile;
    if (existingProfile) {
      profile = await StudentProfile.findOneAndUpdate(
        { student: req.user.id },
        profileData,
        { new: true, runValidators: true }
      );
    } else {
      profile = await StudentProfile.create(profileData);
    }

    // Also sync fullName onto the User doc so it stays consistent everywhere
    if (fullName) {
      await User.findByIdAndUpdate(req.user.id, { fullName, profileCompleted: true });
    } else {
      await User.findByIdAndUpdate(req.user.id, { profileCompleted: true });
    }

    return res.status(existingProfile ? 200 : 201).json({
      success: true,
      message: existingProfile ? "Profile updated successfully" : "Profile completed successfully",
      data: profile,
    });
  } catch (error) {
    console.error("saveProfile error:", error);
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { getMyProfile, saveProfile };
const mongoose = require("mongoose");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");

const PROFILE_FIELDS = [
  "employeeId",
  "designation",
  "department",
  "dateOfJoining",
  "dateOfBirth",
  "gender",
  "alternatePhone",
  "address",
  "emergencyContact",
  "bankDetails",
  "notes",
];

const NESTED_PROFILE_FIELDS = {
  address: ["line1", "line2", "city", "state", "pincode"],
  emergencyContact: ["name", "relation", "phone"],
  bankDetails: ["accountHolderName", "accountNumber", "ifsc", "bankName"],
};

const pickProfileFields = (body = {}) => {
  const update = {};

  for (const field of PROFILE_FIELDS) {
    if (!(field in body)) continue;

    if (NESTED_PROFILE_FIELDS[field]) {
      if (!body[field] || typeof body[field] !== "object" || Array.isArray(body[field])) continue;
      update[field] = {};
      for (const nestedField of NESTED_PROFILE_FIELDS[field]) {
        if (nestedField in body[field]) update[field][nestedField] = body[field][nestedField];
      }
    } else {
      update[field] = body[field];
    }
  }

  return update;
};

const send = (res, status, success, message, data = undefined) => {
  const body = { success, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return send(res, 400, false, "Invalid staff ID");
    }

    const user = await User.findById(userId)
      .select("fullName email phone role branch isActive status profileCompleted createdAt lastLoginAt")
      .lean();

    if (!user) return send(res, 404, false, "Staff member not found");
    if (user.role === "student") return send(res, 400, false, "Student is not a staff member");

    const profile = await StaffProfile.findOne({ user: userId }).lean();

    return send(res, 200, true, "Staff profile fetched", {
      user,
      profile: profile || null,
    });
  } catch (error) {
    console.error("getStaffProfile error:", error);
    return send(res, 500, false, "Server error");
  }
};

const upsertProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return send(res, 400, false, "Invalid staff ID");
    }

    const user = await User.findById(userId).select("_id role");
    if (!user) return send(res, 404, false, "Staff member not found");

    if (user.role === "student") {
      return send(res, 400, false, "Student is not a staff member");
    }

    const update = pickProfileFields(req.body);
    if (!Object.keys(update).length) {
      return send(res, 400, false, "At least one profile field is required");
    }

    const profile = await StaffProfile.findOneAndUpdate(
      { user: userId },
      { $set: update, $setOnInsert: { user: userId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return send(res, 200, true, "Staff profile saved", profile);
  } catch (error) {
    console.error("upsertStaffProfile error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  getProfile,
  upsertProfile,
};

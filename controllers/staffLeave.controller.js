const mongoose = require("mongoose");
const StaffLeave = require("../models/StaffLeave");
const User = require("../models/User");

const send = (res, status, success, message, data = undefined) => {
  const body = { success, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const calculateDays = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const diff = Math.round((to - from) / 86400000) + 1;
  return diff;
};

const createLeave = async (req, res) => {
  try {
    const staffId = req.user.id;
    const { leaveType, fromDate, toDate, reason } = req.body;

    if (!leaveType || !fromDate || !toDate || !reason) {
      return send(
        res,
        400,
        false,
        "leaveType, fromDate, toDate and reason are required"
      );
    }

    const days = calculateDays(fromDate, toDate);

    const parsedFromDate = new Date(fromDate);
    const parsedToDate = new Date(toDate);
    if (Number.isNaN(parsedFromDate.getTime()) || Number.isNaN(parsedToDate.getTime())) {
      return send(res, 400, false, "Invalid leave dates");
    }

    if (days <= 0 || parsedToDate < parsedFromDate) {
      return send(res, 400, false, "toDate must be on or after fromDate");
    }

    const overlapping = await StaffLeave.findOne({
      staff: staffId,
      status: { $in: ["pending", "approved"] },
      fromDate: { $lte: new Date(toDate) },
      toDate: { $gte: new Date(fromDate) },
    });

    if (overlapping) {
      return send(res, 409, false, "An existing leave overlaps these dates");
    }

    const leave = await StaffLeave.create({
      staff: staffId,
      leaveType,
      fromDate,
      toDate,
      days,
      reason,
    });

    return send(res, 201, true, "Leave request submitted", leave);
  } catch (error) {
    console.error("createStaffLeave error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getMyLeaves = async (req, res) => {
  try {
    const leaves = await StaffLeave.find({ staff: req.user.id })
      .sort({ fromDate: -1 })
      .populate("reviewedBy", "fullName role")
      .lean();

    return send(res, 200, true, "Leave requests fetched", leaves);
  } catch (error) {
    console.error("getMyLeaves error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getAllLeaves = async (req, res) => {
  try {
    const { status, staffId, from, to } = req.query;

    const query = {};

    if (status) query.status = status;
    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return send(res, 400, false, "Invalid staff ID");
      }
      query.staff = staffId;
    }

    if (from || to) {
      query.fromDate = {};
      if (from) query.fromDate.$gte = new Date(from);
      if (to) query.fromDate.$lte = new Date(to);
    }

    const leaves = await StaffLeave.find(query)
      .sort({ createdAt: -1 })
      .populate("staff", "fullName email role branch")
      .populate("reviewedBy", "fullName role")
      .lean();

    return send(res, 200, true, "Staff leaves fetched", leaves);
  } catch (error) {
    console.error("getAllStaffLeaves error:", error);
    return send(res, 500, false, "Server error");
  }
};

const reviewLeave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return send(res, 400, false, "Invalid leave ID");
    }

    const leave = await StaffLeave.findById(req.params.id);

    if (!leave) return send(res, 404, false, "Leave request not found");

    const { status, reviewNote = "" } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return send(res, 400, false, "Status must be approved or rejected");
    }

    const requiredPermission = status === "approved" ? "leave.approve" : "leave.reject";
    if (req.user.role !== "super_admin" && !req.permissions?.has(requiredPermission)) {
      return send(res, 403, false, `Missing permission: ${requiredPermission}`);
    }

    if (leave.status !== "pending") {
      return send(res, 409, false, "Only pending leave requests can be reviewed");
    }

    const staff = await User.findOne({ _id: leave.staff, role: { $ne: "student" } }).select("_id");
    if (!staff) return send(res, 404, false, "Staff member not found");

    leave.status = status;
    leave.reviewedBy = req.user.id;
    leave.reviewedAt = new Date();
    leave.reviewNote = reviewNote;

    await leave.save();

    return send(res, 200, true, `Leave ${status}`, leave);
  } catch (error) {
    console.error("reviewStaffLeave error:", error);
    return send(res, 500, false, "Server error");
  }
};

const cancelLeave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return send(res, 400, false, "Invalid leave ID");
    }

    const leave = await StaffLeave.findOne({
      _id: req.params.id,
      staff: req.user.id,
    });

    if (!leave) return send(res, 404, false, "Leave request not found");

    if (leave.status !== "pending") {
      return send(res, 409, false, "Only pending leave can be cancelled");
    }

    leave.status = "cancelled";
    await leave.save();

    return send(res, 200, true, "Leave request cancelled", leave);
  } catch (error) {
    console.error("cancelStaffLeave error:", error);
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  createLeave,
  getMyLeaves,
  getAllLeaves,
  reviewLeave,
  cancelLeave,
};

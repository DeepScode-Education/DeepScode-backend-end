const mongoose = require("mongoose");
const User = require("../models/User");
const StaffAttendance = require("../models/StaffAttendance");

const send = (res, status, success, message, data = undefined) => {
  const body = { success, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStaffAttendance = async (req, res) => {
  try {
    const staffId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return send(res, 400, false, "Invalid staff ID");
    }

    const staff = await User.findOne({ _id: staffId, role: { $ne: "student" } }).select("fullName email role");
    if (!staff) return send(res, 404, false, "Staff member not found");

    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1970 || year > 2100) {
      return send(res, 400, false, "Invalid month or year");
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const records = await StaffAttendance.find({
      staff: staffId,
      date: { $gte: start, $lt: end },
    })
      .sort({ date: 1 })
      .populate("markedBy", "fullName role")
      .lean();

    const summary = {
      totalMarked: records.length,
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      leave: records.filter((r) => r.status === "leave").length,
      halfDay: records.filter((r) => r.status === "half_day").length,
      holiday: records.filter((r) => r.status === "holiday").length,
    };

    return send(res, 200, true, "Staff attendance fetched", {
      staff,
      month,
      year,
      summary,
      records,
    });
  } catch (error) {
    console.error("getStaffAttendance error:", error);
    return send(res, 500, false, "Server error");
  }
};

const markStaffAttendance = async (req, res) => {
  try {
    const staffId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return send(res, 400, false, "Invalid staff ID");
    }

    const staff = await User.findOne({ _id: staffId, role: { $ne: "student" } }).select("_id role");
    if (!staff) return send(res, 404, false, "Staff member not found");

    if (!['super_admin', 'admin', 'hr'].includes(req.user.role)) {
      return send(res, 403, false, "Only Admin or HR can manage staff attendance");
    }

    const { date, status, checkIn, checkOut, note } = req.body;

    const validStatuses = [
      "present",
      "absent",
      "leave",
      "half_day",
      "holiday",
    ];

    if (!date || !validStatuses.includes(status)) {
      return send(res, 400, false, "date and valid status are required");
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return send(res, 400, false, "Invalid attendance date");
    }

    const attendanceDate = startOfDay(parsedDate);

    let workingMinutes = 0;

    if (checkIn && checkOut) {
      const parsedCheckIn = new Date(checkIn);
      const parsedCheckOut = new Date(checkOut);
      if (Number.isNaN(parsedCheckIn.getTime()) || Number.isNaN(parsedCheckOut.getTime())) {
        return send(res, 400, false, "Invalid check-in or check-out time");
      }
      if (parsedCheckOut < parsedCheckIn) {
        return send(res, 400, false, "checkOut must be after checkIn");
      }
      const diff =
        (parsedCheckOut.getTime() - parsedCheckIn.getTime()) / 60000;
      workingMinutes = Math.max(0, Math.round(diff));
    }

    const record = await StaffAttendance.findOneAndUpdate(
      { staff: staffId, date: attendanceDate },
      {
        $set: {
          staff: staffId,
          date: attendanceDate,
          status,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          workingMinutes,
          markedBy: req.user.id,
          note: note || "",
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return send(res, 200, true, "Staff attendance saved", record);
  } catch (error) {
    console.error("markStaffAttendance error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getMyAttendance = async (req, res) => {
  req.params.id = req.user.id;
  return getStaffAttendance(req, res);
};

module.exports = {
  getStaffAttendance,
  markStaffAttendance,
  getMyAttendance,
};

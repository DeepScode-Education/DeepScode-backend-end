const mongoose = require("mongoose");
const StaffPayroll = require("../models/StaffPayroll");
const User = require("../models/User");

const send = (res, status, success, message, data = undefined) => {
  const body = { success, message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const STAFF_ROLES = User.STAFF_ROLES;

const getPayrollInput = (body = {}) => ({
  basicSalary: body.basicSalary,
  allowances: body.allowances ?? 0,
  deductions: body.deductions ?? 0,
  payrollMonth: body.payrollMonth,
  paymentStatus: body.paymentStatus ?? "pending",
  paymentDate: body.paymentDate ?? null,
  notes: body.notes ?? "",
});

const validatePayrollInput = (input) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.payrollMonth || "")) {
    return "payrollMonth must use YYYY-MM format";
  }

  for (const field of ["basicSalary", "allowances", "deductions"]) {
    if (typeof input[field] !== "number" || !Number.isFinite(input[field]) || input[field] < 0) {
      return `${field} must be a non-negative number`;
    }
  }

  if (input.basicSalary + input.allowances < input.deductions) {
    return "deductions cannot exceed gross salary";
  }

  if (!["pending", "paid", "failed"].includes(input.paymentStatus)) {
    return "Invalid paymentStatus";
  }

  if (input.paymentDate !== null && Number.isNaN(new Date(input.paymentDate).getTime())) {
    return "Invalid paymentDate";
  }

  if (typeof input.notes !== "string" || input.notes.length > 2000) {
    return "Invalid notes";
  }

  return null;
};

const findStaff = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return User.findOne({ _id: id, role: { $in: STAFF_ROLES } }).select("_id fullName email role branch");
};

const getPayroll = async (req, res) => {
  try {
    const { staffId, month, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) return send(res, 400, false, "Invalid staff ID");
      query.staff = staffId;
    }
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return send(res, 400, false, "Invalid payroll month");
      query.payrollMonth = month;
    }
    if (status) {
      if (!["pending", "paid", "failed"].includes(status)) return send(res, 400, false, "Invalid payment status");
      query.paymentStatus = status;
    }

    const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const [records, total] = await Promise.all([
      StaffPayroll.find(query)
        .populate("staff", "fullName email role branch")
        .populate("createdBy", "fullName role")
        .sort({ payrollMonth: -1, createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      StaffPayroll.countDocuments(query),
    ]);

    return send(res, 200, true, "Payroll records fetched", {
      records,
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    });
  } catch (error) {
    console.error("getPayroll error:", error);
    return send(res, 500, false, "Server error");
  }
};

const getPayrollById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return send(res, 400, false, "Invalid payroll ID");

    const record = await StaffPayroll.findById(req.params.id)
      .populate("staff", "fullName email role branch")
      .populate("createdBy", "fullName role")
      .lean();
    if (!record) return send(res, 404, false, "Payroll record not found");

    return send(res, 200, true, "Payroll record fetched", record);
  } catch (error) {
    console.error("getPayrollById error:", error);
    return send(res, 500, false, "Server error");
  }
};

const createPayroll = async (req, res) => {
  try {
    const { staff: staffId, ...body } = req.body;
    const staff = await findStaff(staffId);
    if (!staff) return send(res, 404, false, "Staff member not found");

    const input = getPayrollInput(body);
    const validationError = validatePayrollInput(input);
    if (validationError) return send(res, 400, false, validationError);

    const record = await StaffPayroll.create({
      ...input,
      netSalary: input.basicSalary + input.allowances - input.deductions,
      staff: staff._id,
      createdBy: req.user.id,
    });

    return send(res, 201, true, "Payroll record created", record);
  } catch (error) {
    console.error("createPayroll error:", error);
    if (error.code === 11000) return send(res, 409, false, "Payroll already exists for this staff member and month");
    return send(res, 500, false, "Server error");
  }
};

const updatePayroll = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return send(res, 400, false, "Invalid payroll ID");

    const record = await StaffPayroll.findById(req.params.id);
    if (!record) return send(res, 404, false, "Payroll record not found");

    const input = getPayrollInput({
      ...record.toObject(),
      ...req.body,
    });
    const validationError = validatePayrollInput(input);
    if (validationError) return send(res, 400, false, validationError);

    Object.assign(record, input, {
      netSalary: input.basicSalary + input.allowances - input.deductions,
    });
    await record.save();

    return send(res, 200, true, "Payroll record updated", record);
  } catch (error) {
    console.error("updatePayroll error:", error);
    if (error.code === 11000) return send(res, 409, false, "Payroll already exists for this staff member and month");
    return send(res, 500, false, "Server error");
  }
};

module.exports = {
  getPayroll,
  getPayrollById,
  createPayroll,
  updatePayroll,
};

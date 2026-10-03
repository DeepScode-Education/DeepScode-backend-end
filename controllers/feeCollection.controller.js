const mongoose = require("mongoose");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const FeeInstallment = require("../models/FeeInstallment");
const FeeFollowUp = require("../models/FeeFollowUp");
const FeeNote = require("../models/FeeNote");
const User = require("../models/User");
const { reconcilePaymentsToInstallments } = require("../services/feeReconciliation.service");
const { recordPayment, PaymentError } = require("../services/payment.service");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

// ── Access guard ──────────────────────────────────────────────────────────────
// Counsellors may only touch fee-collection data for students explicitly
// assigned to them via `feeCollectionCounsellor` — a separate assignment
// from the lead/demo counsellor (`assignedCounsellor`). Admin, super_admin
// and accountant roles are unrestricted (route-level middleware already
// gates who can reach these handlers at all).
const ensureFeeCounsellorAccess = async (req, studentId) => {
  if (req.user.role !== "counsellor") return true;
  const student = await User.findById(studentId).select("feeCollectionCounsellor");
  return !!(
    student?.feeCollectionCounsellor &&
    String(student.feeCollectionCounsellor) === String(req.user.id)
  );
};

// ── Date helpers ──────────────────────────────────────────────────────────────

const startOfDay = (d = new Date()) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const endOfDay = (d = new Date()) => {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
};

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

// Generate receipt number: deepScodeYYYY-NNNN
const generateReceiptNumber = async (fee) => {
  const year = new Date().getFullYear();
  const next = (fee.lastReceiptNumber || 0) + 1;
  fee.lastReceiptNumber = next;
  return `${fee.receiptPrefix || "deepScode"}-${year}-${String(next).padStart(4, "0")}`;
};

// Recalculate fee totals from successful payments
const recalculateFee = async (studentId) => {
  const fee = await Fee.findOne({ student: studentId });
  if (!fee) return null;

  const payments = await Payment.find({
    student: studentId,
    paymentStatus: "success",
  });

  fee.totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // nextDueDate: earliest unpaid/overdue installment
  const nextInstallment = await FeeInstallment.findOne({
    student: studentId,
    status: { $in: ["pending", "partial", "overdue"] },
  }).sort({ dueDate: 1 });

  fee.nextDueDate = nextInstallment?.dueDate || null;
  await fee.save(); // triggers pre-save → auto-computes feeStatus
  return fee;
};

// Apply payment amount to installments (EMI plans)
const applyPaymentToInstallments = async (studentId, paymentAmount, paymentId) => {
  let remaining = paymentAmount;

  const unpaidInstallments = await FeeInstallment.find({
    student: studentId,
    status: { $in: ["pending", "partial", "overdue"] },
  }).sort({ installmentNumber: 1 });

  for (const inst of unpaidInstallments) {
    if (remaining <= 0) break;
    const toApply = Math.min(remaining, inst.amount - inst.paidAmount);
    inst.paidAmount += toApply;
    inst.payments.push(paymentId);
    remaining -= toApply;
    if (inst.paidAmount >= inst.amount) {
      inst.paidDate = new Date();
    }
    await inst.save();
  }
};

// ── 1. GET /api/fee-collection ────────────────────────────────────────────────
// UPDATED: Counsellors only see students assigned to them for FEE COLLECTION
// specifically (feeCollectionCounsellor), not the lead counsellor
// (assignedCounsellor). These are two independent assignments.
const getFeeCollectionList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      branch = "",
      counsellor = "",
      course = "",
      status = "",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build fee filter
    const feeFilter = {};
    if (branch && isValidId(branch))
      feeFilter.branch = new mongoose.Types.ObjectId(branch);
    if (course && isValidId(course))
      feeFilter.course = new mongoose.Types.ObjectId(course);
    if (status) feeFilter.feeStatus = status;

    if (req.user.role === "counsellor") {
      // ── Scope by fee-collection assignment, NOT lead assignment ────────────
      const assignedStudents = await User.find({
        feeCollectionCounsellor: new mongoose.Types.ObjectId(req.user.id),
        role: "student",
      }).select("_id");
      feeFilter.student = { $in: assignedStudents.map((s) => s._id) };
    } else if (counsellor && isValidId(counsellor)) {
      feeFilter.counsellor = new mongoose.Types.ObjectId(counsellor);
    }

    const pipeline = [
      { $match: feeFilter },
      {
        $lookup: {
          from: "users",
          localField: "student",
          foreignField: "_id",
          as: "studentData",
        },
      },
      { $unwind: { path: "$studentData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "courses",
          localField: "course",
          foreignField: "_id",
          as: "courseData",
        },
      },
      { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "branches",
          localField: "branch",
          foreignField: "_id",
          as: "branchData",
        },
      },
      { $unwind: { path: "$branchData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "counsellor",
          foreignField: "_id",
          as: "counsellorData",
        },
      },
      { $unwind: { path: "$counsellorData", preserveNullAndEmptyArrays: true } },
    ];

    // Search filter after joins
    if (search.trim()) {
      pipeline.push({
        $match: {
          $or: [
            { "studentData.fullName": { $regex: search.trim(), $options: "i" } },
            { "studentData.studentId": { $regex: search.trim(), $options: "i" } },
            { "studentData.email": { $regex: search.trim(), $options: "i" } },
          ],
        },
      });
    }

    // Count total
    const countPipeline = [...pipeline, { $count: "total" }];
    const [countResult] = await Fee.aggregate(countPipeline);
    const total = countResult?.total || 0;

    // Project + paginate
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          totalFees: 1,
          discount: 1,
          finalFee: 1,
          totalPaid: 1,
          remainingAmount: 1,
          feeStatus: 1,
          nextDueDate: 1,
          paymentMode: 1,
          emiMonths: 1,
          createdAt: 1,
          "studentData._id": 1,
          "studentData.fullName": 1,
          "studentData.studentId": 1,
          "studentData.email": 1,
          "studentData.createdAt": 1,
          "courseData._id": 1,
          "courseData.title": 1,
          "branchData._id": 1,
          "branchData.name": 1,
          "counsellorData._id": 1,
          "counsellorData.fullName": 1,
        },
      }
    );

    const fees = await Fee.aggregate(pipeline);

    return send(res, 200, true, "Fee collection list fetched", fees, {
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("getFeeCollectionList error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 2. GET /api/fee-collection/dashboard ──────────────────────────────────────
const getFeeDashboard = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Counsellor scope filter — Fee.counsellor is auto-filled from the
    // student's feeCollectionCounsellor at fee-setup time (see
    // setupFeeWithInstallments below), so this stays consistent with the
    // fee-collection assignment rather than the lead assignment.
    const feeScope =
      req.user.role === "counsellor"
        ? { counsellor: new mongoose.Types.ObjectId(req.user.id) }
        : {};

    // Get fee IDs in scope
    let feeIds = null;
    if (req.user.role === "counsellor") {
      const fees = await Fee.find(feeScope).select("_id");
      feeIds = fees.map((f) => f._id);
    }

    const paymentScope = feeIds
      ? { fee: { $in: feeIds }, paymentStatus: "success" }
      : { paymentStatus: "success" };

    const [
      todayCollection,
      monthlyCollection,
      pendingCollection,
      overdueStudents,
      overdueAmount,
      totalCollection,
      paidCount,
      partialCount,
      overdueCount,
      pendingCount,
    ] = await Promise.all([
      // Today's collection
      Payment.aggregate([
        { $match: { ...paymentScope, paidAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Monthly collection
      Payment.aggregate([
        { $match: { ...paymentScope, paidAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Pending collection (remaining amounts)
      Fee.aggregate([
        { $match: { ...feeScope, feeStatus: { $in: ["pending", "partial", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
      ]),

      // Overdue student count
      Fee.countDocuments({ ...feeScope, feeStatus: "overdue" }),

      // Overdue amount
      Fee.aggregate([
        { $match: { ...feeScope, feeStatus: "overdue" } },
        { $group: { _id: null, total: { $sum: "$remainingAmount" } } },
      ]),

      // Total collection ever
      Payment.aggregate([
        { $match: paymentScope },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Status counts
      Fee.countDocuments({ ...feeScope, feeStatus: "paid" }),
      Fee.countDocuments({ ...feeScope, feeStatus: "partial" }),
      Fee.countDocuments({ ...feeScope, feeStatus: "overdue" }),
      Fee.countDocuments({ ...feeScope, feeStatus: "pending" }),
    ]);

    const totalFees = paidCount + partialCount + overdueCount + pendingCount;
    const collectionPercent =
      totalCollection[0]?.total && pendingCollection[0]?.total
        ? Math.round(
            (totalCollection[0].total /
              (totalCollection[0].total + (pendingCollection[0]?.total || 0))) *
              100
          )
        : totalCollection[0]?.total
        ? 100
        : 0;

    return send(res, 200, true, "Fee dashboard fetched", {
      todayCollection: todayCollection[0]?.total || 0,
      monthlyCollection: monthlyCollection[0]?.total || 0,
      totalCollection: totalCollection[0]?.total || 0,
      pendingCollection: pendingCollection[0]?.total || 0,
      overdueStudents,
      overdueAmount: overdueAmount[0]?.total || 0,
      collectionPercent,
      statusBreakdown: {
        paid: paidCount,
        partial: partialCount,
        overdue: overdueCount,
        pending: pendingCount,
        total: totalFees,
      },
    });
  } catch (err) {
    console.error("getFeeDashboard error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 3. GET /api/fee-collection/recent-payments ────────────────────────────────
const getRecentPayments = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find({ paymentStatus: "success" })
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("student", "fullName studentId email")
        .populate("course", "title")
        .populate("recordedBy", "fullName")
        .populate("branch", "name"),
      Payment.countDocuments({ paymentStatus: "success" }),
    ]);

    return send(res, 200, true, "Recent payments fetched", payments, {
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("getRecentPayments error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 4. GET /api/fee-collection/overdue ────────────────────────────────────────
const getOverdueStudents = async (req, res) => {
  try {
    const scope =
      req.user.role === "counsellor"
        ? { feeStatus: "overdue", counsellor: new mongoose.Types.ObjectId(req.user.id) }
        : { feeStatus: "overdue" };

    const fees = await Fee.find(scope)
      .populate("student", "fullName studentId email")
      .populate("course", "title")
      .populate("branch", "name")
      .populate("counsellor", "fullName")
      .sort({ nextDueDate: 1 });

    return send(res, 200, true, "Overdue students fetched", fees, {
      count: fees.length,
    });
  } catch (err) {
    console.error("getOverdueStudents error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 5. GET /api/fee-collection/:studentId ─────────────────────────────────────
const getStudentFeeDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const [student, fee, payments, installments, followUps, notes] =
      await Promise.all([
        User.findById(studentId).select("-password").populate("branch", "name code"),
        Fee.findOne({ student: studentId })
          .populate("course", "title category price duration")
          .populate("branch", "name code")
          .populate("counsellor", "fullName email")
          .populate("createdBy", "fullName"),
        Payment.find({ student: studentId, paymentStatus: "success" })
          .sort({ paymentNumber: 1 })
          .populate("recordedBy", "fullName")
          .populate("branch", "name")
          .populate("course", "title"),
        FeeInstallment.find({ student: studentId })
          .sort({ installmentNumber: 1 })
          .populate("payments", "amount paidAt paymentMethod receiptNumber"),
        FeeFollowUp.find({ student: studentId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("createdBy", "fullName role"),
        FeeNote.find({ student: studentId })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate("addedBy", "fullName role"),
      ]);

    if (!student) return send(res, 404, false, "Student not found");

    return send(res, 200, true, "Student fee details fetched", {
      student,
      fee,
      payments,
      installments,
      recentFollowUps: followUps,
      recentNotes: notes,
    });
  } catch (err) {
    console.error("getStudentFeeDetails error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 6. POST /api/fee-collection/:studentId/payment ───────────────────────────
// const addPayment = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

//     if (!(await ensureFeeCounsellorAccess(req, studentId))) {
//       return send(res, 403, false, "You are not assigned to handle this student's fee collection");
//     }

//     const {
//       amount,
//       paymentMethod = "UPI",
//       transactionId,
//       paidAt,
//       notes = "",
//     } = req.body;

//     if (!amount || Number(amount) <= 0) {
//       return send(res, 400, false, "Amount must be greater than 0");
//     }

//     const student = await User.findById(studentId);
//     if (!student || student.role !== "student") {
//       return send(res, 404, false, "Student not found");
//     }

//     const fee = await Fee.findOne({ student: studentId });
//     if (!fee) {
//       return send(
//         res,
//         400,
//         false,
//         "No fee plan found. Set up a fee plan first."
//       );
//     }

//     const VALID_METHODS = [
//       "Cash",
//       "UPI",
//       "Bank Transfer",
//       "Card",
//       "Cheque",
//       "Other",
//     ];
//     if (!VALID_METHODS.includes(paymentMethod)) {
//       return send(
//         res,
//         400,
//         false,
//         `Payment method must be one of: ${VALID_METHODS.join(", ")}`
//       );
//     }

//     // Auto-generate receipt number
//     const receiptNumber = await generateReceiptNumber(fee);

//     // Get next payment number
//     const lastPayment = await Payment.findOne({ student: studentId }).sort({
//       paymentNumber: -1,
//     });
//     const paymentNumber = lastPayment ? lastPayment.paymentNumber + 1 : 1;

//     // Create payment
//     const payment = await Payment.create({
//       student: studentId,
//       fee: fee._id,
//       course: fee.course || null,
//       paymentNumber,
//       amount: Number(amount),
//       paymentMethod,
//       transactionId: transactionId || null,
//       paymentStatus: "success",
//       paidAt: paidAt ? new Date(paidAt) : new Date(),
//       recordedBy: req.user.id,
//       receiptNumber,
//       notes,
//       branch: fee.branch || student.branch || null,
//     });

//     // Apply to installments (EMI plan)
//     if (fee.paymentMode === "emi") {
//       await applyPaymentToInstallments(
//         studentId,
//         Number(amount),
//         payment._id
//       );
//     }

//     // Save updated receipt counter
//     await fee.save();

//     // Recalculate fee totals
//     const updatedFee = await recalculateFee(studentId);

//     const populatedPayment = await Payment.findById(payment._id)
//       .populate("recordedBy", "fullName")
//       .populate("course", "title");

//     return send(res, 201, true, "Payment recorded successfully", {
//       payment: populatedPayment,
//       fee: updatedFee,
//     });
//   } catch (err) {
//     console.error("addPayment error:", err);
//     return send(res, 500, false, "Server Error");
//   }
// };


// ── 6. POST /api/fee-collection/:studentId/payment ───────────────────────────
const addPayment = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return send(res, 404, false, "Student not found");
    }

    const fee = await Fee.findOne({ student: studentId });
    const branch = (fee && fee.branch) || student.branch || null;

    const { payment, fee: updatedFee } = await recordPayment(
      studentId,
      { ...req.body, branch },
      req.user.id
    );

    return send(res, 201, true, "Payment recorded successfully", { payment, fee: updatedFee });
  } catch (err) {
    console.error("addPayment error:", err);
    if (err instanceof PaymentError) {
      return send(res, err.statusCode || 400, false, err.message);
    }
    return send(res, 500, false, "Server Error");
  }
};

// ── 7. GET /api/fee-collection/:studentId/installments ───────────────────────
const getInstallments = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const installments = await FeeInstallment.find({ student: studentId })
      .sort({ installmentNumber: 1 })
      .populate("payments", "amount paidAt paymentMethod receiptNumber");

    return send(res, 200, true, "Installments fetched", installments);
  } catch (err) {
    console.error("getInstallments error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 8. GET /api/fee-collection/:studentId/follow-ups ─────────────────────────
const getFeeFollowUps = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const followUps = await FeeFollowUp.find({ student: studentId })
      .sort({ createdAt: -1 })
      .populate("createdBy", "fullName role")
      .populate("updatedBy", "fullName");

    return send(res, 200, true, "Fee follow-ups fetched", followUps);
  } catch (err) {
    console.error("getFeeFollowUps error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 9. POST /api/fee-collection/:studentId/follow-ups ────────────────────────
const addFeeFollowUp = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const {
      callStatus,
      nextFollowUpDate,
      expectedPaymentDate,
      expectedAmount,
      remarks,
    } = req.body;

    const VALID_CALL_STATUSES = [
      "Connected",
      "Busy",
      "Switched Off",
      "Parent Talked",
      "Student Talked",
      "No Response",
    ];
    if (!callStatus || !VALID_CALL_STATUSES.includes(callStatus)) {
      return send(
        res,
        400,
        false,
        `callStatus must be one of: ${VALID_CALL_STATUSES.join(", ")}`
      );
    }

    const fee = await Fee.findOne({ student: studentId });
    if (!fee)
      return send(res, 404, false, "No fee plan found for this student");

    const followUp = await FeeFollowUp.create({
      fee: fee._id,
      student: studentId,
      callStatus,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      expectedPaymentDate: expectedPaymentDate
        ? new Date(expectedPaymentDate)
        : null,
      expectedAmount: expectedAmount ? Number(expectedAmount) : null,
      remarks: remarks || "",
      createdBy: req.user.id,
    });

    const populated = await FeeFollowUp.findById(followUp._id).populate(
      "createdBy",
      "fullName role"
    );

    return send(res, 201, true, "Follow-up added", populated);
  } catch (err) {
    console.error("addFeeFollowUp error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 10. PUT /api/fee-collection/:studentId/follow-ups/:id ────────────────────
const updateFeeFollowUp = async (req, res) => {
  try {
    const { studentId, id } = req.params;
    if (!isValidId(studentId) || !isValidId(id)) {
      return send(res, 400, false, "Invalid ID");
    }

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const {
      callStatus,
      nextFollowUpDate,
      expectedPaymentDate,
      expectedAmount,
      remarks,
      status,
    } = req.body;

    const followUp = await FeeFollowUp.findOne({
      _id: id,
      student: studentId,
    });
    if (!followUp) return send(res, 404, false, "Follow-up not found");

    const VALID_CALL_STATUSES = [
      "Connected",
      "Busy",
      "Switched Off",
      "Parent Talked",
      "Student Talked",
      "No Response",
    ];

    if (callStatus) {
      if (!VALID_CALL_STATUSES.includes(callStatus)) {
        return send(
          res,
          400,
          false,
          `callStatus must be one of: ${VALID_CALL_STATUSES.join(", ")}`
        );
      }
      followUp.callStatus = callStatus;
    }
    if (nextFollowUpDate !== undefined)
      followUp.nextFollowUpDate = nextFollowUpDate
        ? new Date(nextFollowUpDate)
        : null;
    if (expectedPaymentDate !== undefined)
      followUp.expectedPaymentDate = expectedPaymentDate
        ? new Date(expectedPaymentDate)
        : null;
    if (expectedAmount !== undefined)
      followUp.expectedAmount = expectedAmount ? Number(expectedAmount) : null;
    if (remarks !== undefined) followUp.remarks = remarks;
    if (status === "completed") {
      followUp.status = "completed";
      followUp.completedAt = new Date();
    }
    followUp.updatedBy = req.user.id;

    await followUp.save();

    const populated = await FeeFollowUp.findById(followUp._id)
      .populate("createdBy", "fullName role")
      .populate("updatedBy", "fullName");

    return send(res, 200, true, "Follow-up updated", populated);
  } catch (err) {
    console.error("updateFeeFollowUp error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 11. GET /api/fee-collection/:studentId/notes ─────────────────────────────
const getFeeNotes = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const notes = await FeeNote.find({ student: studentId })
      .sort({ createdAt: -1 })
      .populate("addedBy", "fullName role");

    return send(res, 200, true, "Fee notes fetched", notes);
  } catch (err) {
    console.error("getFeeNotes error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 12. POST /api/fee-collection/:studentId/notes ────────────────────────────
const addFeeNote = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    if (!(await ensureFeeCounsellorAccess(req, studentId))) {
      return send(res, 403, false, "You are not assigned to handle this student's fee collection");
    }

    const { note } = req.body;
    if (!note || !note.trim())
      return send(res, 400, false, "Note content is required");

    const fee = await Fee.findOne({ student: studentId });
    if (!fee)
      return send(res, 404, false, "No fee plan found for this student");

    const feeNote = await FeeNote.create({
      fee: fee._id,
      student: studentId,
      note: note.trim(),
      addedBy: req.user.id,
    });

    const populated = await FeeNote.findById(feeNote._id).populate(
      "addedBy",
      "fullName role"
    );

    return send(res, 201, true, "Note added", populated);
  } catch (err) {
    console.error("addFeeNote error:", err);
    return send(res, 500, false, "Server Error");
  }
};

// ── 13. POST/PUT /api/fee-collection/:studentId/fee-setup ────────────────────
// Full fee setup with installment generation for EMI plans.
// UPDATED: if `counsellor` is not explicitly supplied in the body, auto-fill
// it from the student's `feeCollectionCounsellor` assignment so the fee
// dashboard/overdue scoping (which filters by Fee.counsellor) stays in sync
// with the independent fee-collection assignment without extra admin steps.
// const setupFeeWithInstallments = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

//     const {
//       totalFees,
//       discount = 0,
//       paymentMode,
//       emiMonths,
//       course,
//       counsellor,
//       branch,
//       startDate,
//     } = req.body;

//     const student = await User.findById(studentId);
//     if (!student || student.role !== "student") {
//       return send(res, 404, false, "Student not found");
//     }

//     if (!totalFees || Number(totalFees) <= 0) {
//       return send(res, 400, false, "totalFees must be greater than 0");
//     }
//     if (!["full", "emi"].includes(paymentMode)) {
//       return send(res, 400, false, "paymentMode must be 'full' or 'emi'");
//     }
//     if (paymentMode === "emi" && (!emiMonths || Number(emiMonths) < 1)) {
//       return send(res, 400, false, "emiMonths is required for EMI mode");
//     }

//     // Resolve counsellor: explicit body value > student's fee-collection
//     // assignment > existing value on the fee doc (handled below per-branch)
//     const resolvedCounsellor = counsellor || student.feeCollectionCounsellor || null;

//     let fee = await Fee.findOne({ student: studentId });
//     if (fee) {
//       fee.totalFees = Number(totalFees);
//       fee.discount = Number(discount);
//       fee.paymentMode = paymentMode;
//       fee.emiMonths = paymentMode === "emi" ? Number(emiMonths) : null;
//       if (course) fee.course = course;
//       if (counsellor) {
//         fee.counsellor = counsellor;
//       } else if (!fee.counsellor && student.feeCollectionCounsellor) {
//         fee.counsellor = student.feeCollectionCounsellor;
//       }
//       if (branch) fee.branch = branch;
//       fee.createdBy = req.user.id;
//     } else {
//       fee = new Fee({
//         student: studentId,
//         totalFees: Number(totalFees),
//         discount: Number(discount),
//         paymentMode,
//         emiMonths: paymentMode === "emi" ? Number(emiMonths) : null,
//         course: course || null,
//         counsellor: resolvedCounsellor,
//         branch: branch || student.branch || null,
//         createdBy: req.user.id,
//       });
//     }
//     await fee.save();

//     // Generate installment schedule for EMI plans
//     // if (paymentMode === "emi") {
//     //   await FeeInstallment.deleteMany({ student: studentId });

//     //   const months = Number(emiMonths);
//     //   const monthlyAmount =
//     //     Math.round((fee.finalFee / months) * 100) / 100;
//     //   const firstDue = startDate ? new Date(startDate) : new Date();

//     //   const installments = [];
//     //   for (let i = 0; i < months; i++) {
//     //     const dueDate = new Date(firstDue);
//     //     dueDate.setMonth(dueDate.getMonth() + i);
//     //     installments.push({
//     //       fee: fee._id,
//     //       student: studentId,
//     //       installmentNumber: i + 1,
//     //       dueDate,
//     //       amount: monthlyAmount,
//     //       paidAmount: 0,
//     //       remainingAmount: monthlyAmount,
//     //       status: new Date() > dueDate ? "overdue" : "pending",
//     //     });
//     //   }
//     //   await FeeInstallment.insertMany(installments);

//     //   fee.nextDueDate = installments[0].dueDate;
//     //   await fee.save();
//     // }


      
//     if (paymentMode === "emi") {
//       await FeeInstallment.deleteMany({ student: studentId });

//       const months = Number(emiMonths);
//       const monthlyAmount =
//         Math.round((fee.finalFee / months) * 100) / 100;
//       const firstDue = startDate ? new Date(startDate) : new Date();

//       const installments = [];
//       for (let i = 0; i < months; i++) {
//         const dueDate = new Date(firstDue);
//         dueDate.setMonth(dueDate.getMonth() + i);
//         installments.push({
//           fee: fee._id,
//           student: studentId,
//           installmentNumber: i + 1,
//           dueDate,
//           amount: monthlyAmount,
//           paidAmount: 0,
//           remainingAmount: monthlyAmount,
//           status: new Date() > dueDate ? "overdue" : "pending",
//         });
//       }
//       await FeeInstallment.insertMany(installments);

//       await reconcilePaymentsToInstallments(studentId, fee._id);
//       // reconcilePaymentsToInstallments() already sets fee.nextDueDate and
//       // fee.totalPaid — no manual fee.nextDueDate assignment needed here.
//     }

//     const updatedFee = await Fee.findById(fee._id)
//       .populate("course", "title")
//       .populate("branch", "name")
//       .populate("counsellor", "fullName");

//     return send(res, 200, true, "Fee plan saved successfully", updatedFee);
//   } catch (err) {
//     console.error("setupFeeWithInstallments error:", err);
//     return send(res, 500, false, "Server Error");
//   }
// };


const setupFeeWithInstallments = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidId(studentId)) return send(res, 400, false, "Invalid student ID");

    const {
      totalFees, discount = 0, paymentMode, emiMonths,
      course, counsellor, branch, startDate,
      registrationPayment, // NEW
    } = req.body;

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") return send(res, 404, false, "Student not found");
    if (!totalFees || Number(totalFees) <= 0) return send(res, 400, false, "totalFees must be greater than 0");
    if (!["full", "emi"].includes(paymentMode)) return send(res, 400, false, "paymentMode must be 'full' or 'emi'");
    if (paymentMode === "emi" && (!emiMonths || Number(emiMonths) < 1))
      return send(res, 400, false, "emiMonths is required for EMI mode");

    let fee = await Fee.findOne({ student: studentId });
    const finalFeeForCalc = Math.max(Number(totalFees) - Number(discount || 0), 0);

    const existingRegistrationPayment = await Payment.findOne({
      student: studentId, isRegistrationPayment: true, paymentStatus: "success",
    });
    let registrationAmountToDeduct = existingRegistrationPayment ? existingRegistrationPayment.amount : 0;
    const wantsNewRegistrationPayment =
      !existingRegistrationPayment && registrationPayment && Number(registrationPayment.amount) > 0;

    if (wantsNewRegistrationPayment) {
      const regAmount = Number(registrationPayment.amount);
      if (regAmount > finalFeeForCalc) {
        return send(res, 400, false, "Registration/initial payment cannot exceed the payable fee");
      }
      registrationAmountToDeduct = regAmount;
    }

    // ... existing fee create/update logic unchanged ...
    await fee.save();

    if (wantsNewRegistrationPayment) {
      const nextNumber = await getNextPaymentNumber(studentId); // reuse existing helper pattern
      await Payment.create({
        student: studentId,
        fee: fee._id,
        course: course || fee.course || null,
        paymentNumber: nextNumber,
        amount: Number(registrationPayment.amount),
        paymentMethod: registrationPayment.paymentMethod || "UPI",
        transactionId: registrationPayment.transactionId || null,
        paymentStatus: "success",
        paidAt: registrationPayment.paidAt ? new Date(registrationPayment.paidAt) : new Date(),
        recordedBy: req.user.id,
        isRegistrationPayment: true,
        branch: branch || student.branch || null,
        notes: "Registration / Admission / Initial Payment",
      });
    }

    if (paymentMode === "emi") {
      await FeeInstallment.deleteMany({ student: studentId });
      const months = Number(emiMonths);
      const payableAmount = Math.max(finalFeeForCalc - registrationAmountToDeduct, 0);
      const monthlyAmount = Math.round((payableAmount / months) * 100) / 100;
      const firstDue = startDate ? new Date(startDate) : new Date();

      const installments = [];
      for (let i = 0; i < months; i++) {
        const dueDate = new Date(firstDue);
        dueDate.setMonth(dueDate.getMonth() + i);
        installments.push({
          fee: fee._id, student: studentId, installmentNumber: i + 1, dueDate,
          amount: monthlyAmount, paidAmount: 0, remainingAmount: monthlyAmount,
          status: new Date() > dueDate ? "overdue" : "pending",
        });
      }
      await FeeInstallment.insertMany(installments);
      await reconcilePaymentsToInstallments(studentId, fee._id);
    }

    const updatedFee = await Fee.findById(fee._id)
      .populate("course", "title").populate("branch", "name").populate("counsellor", "fullName");
    return send(res, 200, true, "Fee plan saved successfully", updatedFee);
  } catch (err) {
    console.error("setupFeeWithInstallments error:", err);
    return send(res, 500, false, "Server Error");
  }
};

module.exports = {
  getFeeCollectionList,
  getFeeDashboard,
  getRecentPayments,
  getOverdueStudents,
  getStudentFeeDetails,
  addPayment,
  getInstallments,
  getFeeFollowUps,
  addFeeFollowUp,
  updateFeeFollowUp,
  getFeeNotes,
  addFeeNote,
  setupFeeWithInstallments,
};
// const Fee = require("../models/Fee");
// const Payment = require("../models/Payment");
// const User = require("../models/User");
// const FeeInstallment = require("../models/FeeInstallment");

// const recalculateFeeTotals = async (studentId) => {
//   const fee = await Fee.findOne({ student: studentId });
//   if (!fee) return null;

//   const successfulPayments = await Payment.find({
//     student: studentId,
//     paymentStatus: "success",
//   });
//   const totalPaid = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

//   fee.totalPaid = totalPaid;

//   // ── Auto-advance nextDueDate after payment ───────────────────────────────────
//   const remaining = Math.max((fee.finalFee || fee.totalFees) - totalPaid, 0);

//   if (remaining <= 0) {
//     fee.nextDueDate = null;
//   } else if (fee.nextDueDate) {
//     const now = new Date();
//     const due = new Date(fee.nextDueDate);

//     if (due <= now) {
//       const next = new Date(due);
//       next.setMonth(next.getMonth() + 1);
//       fee.nextDueDate = next;
//     }
//   }

//   await fee.save(); // triggers pre-save → feeStatus recalculation
//   return fee;
// };

// const getNextPaymentNumber = async (studentId) => {
//   const last = await Payment.findOne({ student: studentId }).sort({ paymentNumber: -1 });
//   return last ? last.paymentNumber + 1 : 1;
// };

// // ── NEW: Apply a payment amount across unpaid installments, oldest first ──────
// // Reused from feeCollection.controller.js's pattern — never modifies an
// // installment that's already fully paid, and never removes history.
// const applyPaymentToInstallments = async (studentId, paymentAmount, paymentId) => {
//   let remaining = paymentAmount;

//   const unpaidInstallments = await FeeInstallment.find({
//     student: studentId,
//     status: { $in: ["pending", "partial", "overdue"] },
//   }).sort({ installmentNumber: 1 });

//   for (const inst of unpaidInstallments) {
//     if (remaining <= 0) break;
//     const toApply = Math.min(remaining, inst.amount - inst.paidAmount);
//     if (toApply <= 0) continue;
//     inst.paidAmount += toApply;
//     inst.payments.push(paymentId);
//     remaining -= toApply;
//     await inst.save(); // pre-save hook recomputes status/remainingAmount/paidDate
//   }
// };

// // ── NEW: Intelligently regenerate the EMI schedule whenever the fee plan
// // changes (mode switch, totalFees edit, emiMonths edit). Installments that
// // already have paidAmount > 0 are NEVER touched or deleted — only the
// // unpaid/future portion of the schedule is rebuilt around them. ─────────────
// const regenerateInstallmentsForFee = async (fee, studentId) => {
//   if (!fee) return;

//   if (fee.paymentMode !== "emi" || !fee.emiMonths) {
//     // Switched away from EMI (or no months set) — drop only the untouched,
//     // fully-unpaid installments. Anything with a payment stays as history.
//     await FeeInstallment.deleteMany({ student: studentId, paidAmount: 0 });
//     return;
//   }

//   const existing = await FeeInstallment.find({ student: studentId }).sort({ installmentNumber: 1 });
//   const preserved = existing.filter((i) => i.paidAmount > 0);
//   const toRemove = existing.filter((i) => i.paidAmount === 0);

//   if (toRemove.length) {
//     await FeeInstallment.deleteMany({ _id: { $in: toRemove.map((d) => d._id) } });
//   }

//   const preservedTotal = preserved.reduce((sum, i) => sum + i.amount, 0);
//   const remainingAmount = Math.max((fee.finalFee || fee.totalFees) - preservedTotal, 0);
//   const remainingMonths = Math.max(fee.emiMonths - preserved.length, 0);

//   if (remainingMonths <= 0 || remainingAmount <= 0) return;

//   const monthlyAmount = Math.round((remainingAmount / remainingMonths) * 100) / 100;

//   let startDate;
//   if (preserved.length > 0) {
//     startDate = new Date(preserved[preserved.length - 1].dueDate);
//     startDate.setMonth(startDate.getMonth() + 1);
//   } else {
//     startDate = fee.nextDueDate ? new Date(fee.nextDueDate) : new Date();
//   }

//   const docs = [];
//   for (let i = 0; i < remainingMonths; i++) {
//     const dueDate = new Date(startDate);
//     dueDate.setMonth(dueDate.getMonth() + i);
//     docs.push({
//       fee: fee._id,
//       student: studentId,
//       installmentNumber: preserved.length + i + 1,
//       dueDate,
//       amount: monthlyAmount,
//       paidAmount: 0,
//       remainingAmount: monthlyAmount,
//       status: new Date() > dueDate ? "overdue" : "pending",
//     });
//   }

//   if (docs.length) await FeeInstallment.insertMany(docs);
// };

// // POST/PUT /api/admin/students/:id/fee
// const setupFee = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       totalFees,
//       paymentMode,
//       emiMonths,
//       course,
//       payments,
//       nextDueDate, // ← admin-supplied due date (ISO string)
//     } = req.body;

//     const student = await User.findById(id);
//     if (!student || student.role !== "student") {
//       return res.status(404).json({ success: false, message: "Student Not Found" });
//     }

//     if (!totalFees || Number(totalFees) <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Total fees must be greater than 0",
//       });
//     }
//     if (!["full", "emi"].includes(paymentMode)) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment mode must be 'full' or 'emi'",
//       });
//     }
//     if (paymentMode === "emi" && (!emiMonths || Number(emiMonths) < 1)) {
//       return res.status(400).json({
//         success: false,
//         message: "EMI months is required for EMI mode",
//       });
//     }

//     // ── Resolve due date ────────────────────────────────────────────────────────
//     let resolvedDueDate = null;

//     if (nextDueDate) {
//       const parsed = new Date(nextDueDate);
//       if (!isNaN(parsed.getTime())) {
//         resolvedDueDate = parsed;
//       }
//     } else if (paymentMode === "emi") {
//       const defaultDue = new Date();
//       defaultDue.setMonth(defaultDue.getMonth() + 1);
//       defaultDue.setHours(0, 0, 0, 0);
//       resolvedDueDate = defaultDue;
//     }

//     let fee = await Fee.findOne({ student: id });

//     if (fee) {
//       fee.totalFees = totalFees;
//       fee.paymentMode = paymentMode;
//       fee.emiMonths = paymentMode === "emi" ? emiMonths : null;
//       if (course) fee.course = course;
//       fee.createdBy = req.user.id;

//       if (nextDueDate || !fee.nextDueDate) {
//         fee.nextDueDate = resolvedDueDate;
//       }
//     } else {
//       fee = new Fee({
//         student: id,
//         course: course || null,
//         totalFees,
//         paymentMode,
//         emiMonths: paymentMode === "emi" ? emiMonths : null,
//         nextDueDate: resolvedDueDate,
//         createdBy: req.user.id,
//       });
//     }
//     await fee.save();

//     if (Array.isArray(payments) && payments.length > 0) {
//       let nextNumber = await getNextPaymentNumber(id);
//       const docs = payments
//         .filter((p) => p.amount && Number(p.amount) > 0)
//         .map((p) => ({
//           student: id,
//           fee: fee._id,
//           course: course || fee.course || null,
//           paymentNumber: nextNumber++,
//           amount: Number(p.amount),
//           paymentMethod: p.paymentMethod || "UPI",
//           transactionId: p.transactionId || null,
//           paymentStatus: "success",
//           paidAt: p.paidAt || new Date(),
//           recordedBy: req.user.id,
//         }));

//       if (docs.length > 0) await Payment.insertMany(docs);
//     }

//     const updatedFee = await recalculateFeeTotals(id);

//     // ── NEW: keep EMI schedule in sync with the (possibly just-changed) fee plan.
//     // Paid installments are preserved automatically inside this function.
//     await regenerateInstallmentsForFee(updatedFee, id);

//     return res.status(200).json({
//       success: true,
//       message: "Fee plan saved successfully",
//       data: updatedFee,
//     });
//   } catch (error) {
//     console.error("setupFee error:", error);
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors)
//         .map((e) => e.message)
//         .join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // GET /api/admin/students/:id/fee
// const getFeeByStudent = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const fee = await Fee.findOne({ student: id }).populate("course", "title price");
//     const payments = await Payment.find({ student: id }).sort({ paymentNumber: 1 });
//     return res.status(200).json({ success: true, data: fee, payments });
//   } catch (error) {
//     console.error("getFeeByStudent error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // GET /api/student/fee
// const getMyFee = async (req, res) => {
//   try {
//     const fee = await Fee.findOne({ student: req.user.id }).populate("course", "title price");
//     const payments = await Payment.find({
//       student: req.user.id,
//       paymentStatus: "success",
//     }).sort({ paymentNumber: 1 });
//     return res.status(200).json({ success: true, data: fee, payments });
//   } catch (error) {
//     console.error("getMyFee error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // ── Fee-based login eligibility check (students only) ─────────────────────────
// const checkFeeLoginEligibility = async (studentId) => {
//   const fee = await Fee.findOne({ student: studentId });

//   console.log("LOGIN FEE CHECK:", {
//     studentId,
//     fee
//   });

//   if (!fee) {
//     return {
//       blocked: true,
//       feeStatus: "no-plan",
//       message:
//         "Your fee plan is not created. Please contact admin."
//     };
//   }

//   if (
//     fee.feeStatus === "paid" ||
//     fee.remainingAmount <= 0
//   ) {
//     return {
//       blocked: false,
//       feeStatus: fee.feeStatus,
//       remainingAmount: fee.remainingAmount,
//       nextDueDate: fee.nextDueDate,
//     };
//   }

//   const now = new Date();
//   const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//   const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

//   const paidThisMonth = await Payment.findOne({
//     student: studentId,
//     paymentStatus: "success",
//     paidAt: { $gte: monthStart, $lte: monthEnd },
//   });

//   if (paidThisMonth) {
//     return {
//       blocked: false,
//       feeStatus: fee.feeStatus,
//       remainingAmount: fee.remainingAmount,
//       nextDueDate: fee.nextDueDate,
//     };
//   }

//   return {
//     blocked: true,
//     feeStatus: fee.feeStatus,
//     totalFees: fee.finalFee,
//     totalPaid: fee.totalPaid,
//     remainingAmount: fee.remainingAmount,
//     nextDueDate: fee.nextDueDate,
//     message:
//       "Your fee payment is overdue. Please clear your pending dues to continue accessing your account.",
//   };
// };

// // ── NEW: GET /api/admin/students/:id/fee/installments ────────────────────────
// const getInstallments = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const installments = await FeeInstallment.find({ student: id })
//       .sort({ installmentNumber: 1 })
//       .populate("payments", "amount paidAt paymentMethod");
//     return res.status(200).json({ success: true, data: installments });
//   } catch (error) {
//     console.error("getInstallments error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // ── NEW: POST /api/admin/students/:id/fee/installments ───────────────────────
// const addInstallment = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { amount, dueDate } = req.body;

//     if (!amount || Number(amount) <= 0) {
//       return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
//     }
//     if (!dueDate) {
//       return res.status(400).json({ success: false, message: "Due date is required" });
//     }

//     const fee = await Fee.findOne({ student: id });
//     if (!fee) {
//       return res.status(404).json({ success: false, message: "No fee plan found for this student" });
//     }
//     if (fee.paymentMode !== "emi") {
//       return res.status(400).json({
//         success: false,
//         message: "EMI schedule is only available when the payment mode is set to EMI",
//       });
//     }

//     const last = await FeeInstallment.findOne({ student: id }).sort({ installmentNumber: -1 });
//     const nextNumber = last ? last.installmentNumber + 1 : 1;
//     const dueDateObj = new Date(dueDate);

//     if (isNaN(dueDateObj.getTime())) {
//       return res.status(400).json({ success: false, message: "Invalid due date" });
//     }

//     const installment = await FeeInstallment.create({
//       fee: fee._id,
//       student: id,
//       installmentNumber: nextNumber,
//       dueDate: dueDateObj,
//       amount: Number(amount),
//       paidAmount: 0,
//       remainingAmount: Number(amount),
//       status: new Date() > dueDateObj ? "overdue" : "pending",
//     });

//     fee.emiMonths = (fee.emiMonths || 0) + 1;
//     await fee.save();

//     return res.status(201).json({ success: true, message: "EMI added successfully", data: installment });
//   } catch (error) {
//     console.error("addInstallment error:", error);
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors).map((e) => e.message).join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // ── NEW: PUT /api/admin/students/:id/fee/installments/:installmentId ─────────
// const updateInstallment = async (req, res) => {
//   try {
//     const { id, installmentId } = req.params;
//     const { amount, dueDate } = req.body;

//     const installment = await FeeInstallment.findOne({ _id: installmentId, student: id });
//     if (!installment) {
//       return res.status(404).json({ success: false, message: "EMI installment not found" });
//     }

//     if (installment.paidAmount > 0) {
//       return res.status(400).json({
//         success: false,
//         message: "This EMI already has a payment recorded against it and cannot be modified",
//       });
//     }

//     if (amount !== undefined) {
//       if (!amount || Number(amount) <= 0) {
//         return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
//       }
//       installment.amount = Number(amount);
//     }

//     if (dueDate !== undefined) {
//       const dueDateObj = new Date(dueDate);
//       if (isNaN(dueDateObj.getTime())) {
//         return res.status(400).json({ success: false, message: "Invalid due date" });
//       }
//       installment.dueDate = dueDateObj;
//     }

//     await installment.save();

//     return res.status(200).json({ success: true, message: "EMI updated successfully", data: installment });
//   } catch (error) {
//     console.error("updateInstallment error:", error);
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors).map((e) => e.message).join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// // ── NEW: DELETE /api/admin/students/:id/fee/installments/:installmentId ──────
// const deleteInstallment = async (req, res) => {
//   try {
//     const { id, installmentId } = req.params;

//     const installment = await FeeInstallment.findOne({ _id: installmentId, student: id });
//     if (!installment) {
//       return res.status(404).json({ success: false, message: "EMI installment not found" });
//     }

//     if (installment.paidAmount > 0) {
//       return res.status(400).json({
//         success: false,
//         message: "This EMI already has a payment recorded against it and cannot be deleted",
//       });
//     }

//     await FeeInstallment.deleteOne({ _id: installmentId });

//     const fee = await Fee.findOne({ student: id });
//     if (fee && fee.emiMonths > 0) {
//       fee.emiMonths = Math.max(fee.emiMonths - 1, 0);
//       await fee.save();
//     }

//     return res.status(200).json({ success: true, message: "EMI deleted successfully" });
//   } catch (error) {
//     console.error("deleteInstallment error:", error);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

// module.exports = {
//   setupFee,
//   getFeeByStudent,
//   getMyFee,
//   recalculateFeeTotals,
//   getNextPaymentNumber,
//   checkFeeLoginEligibility,
//   applyPaymentToInstallments,
//   regenerateInstallmentsForFee,
//   getInstallments,
//   addInstallment,
//   updateInstallment,
//   deleteInstallment,
// };









const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const User = require("../models/User");
const FeeInstallment = require("../models/FeeInstallment");
const { reconcilePaymentsToInstallments } = require("../services/feeReconciliation.service");

// ── NEW: sync EMI installments against the incoming plan, preserving paid ones ──
// - Never overwrites amount/dueDate/history on an installment that already
//   has paidAmount > 0.
// - Creates new installment docs for any new EMI slots.
// - Deletes only unpaid installments that fall beyond the new EMI count.
const syncEmiInstallments = async (fee, studentId, incomingInstallments) => {
  const existing = await FeeInstallment.find({ student: studentId }).sort({ installmentNumber: 1 });
  const existingByNumber = new Map(existing.map((e) => [e.installmentNumber, e]));
  const keepNumbers = new Set();

  for (let i = 0; i < incomingInstallments.length; i++) {
    const num = i + 1;
    keepNumbers.add(num);
    const incoming = incomingInstallments[i];
    const existingDoc = existingByNumber.get(num);

    if (existingDoc && existingDoc.paidAmount > 0) {
      // Already has payment history — never overwrite amount/date/history.
      continue;
    }

    if (existingDoc) {
      existingDoc.amount = Number(incoming.amount);
      existingDoc.dueDate = new Date(incoming.dueDate);
      await existingDoc.save(); // pre-save hook recomputes remainingAmount/status
    } else {
      const dueDateObj = new Date(incoming.dueDate);
      await FeeInstallment.create({
        fee: fee._id,
        student: studentId,
        installmentNumber: num,
        dueDate: dueDateObj,
        amount: Number(incoming.amount),
        paidAmount: 0,
        remainingAmount: Number(incoming.amount),
        status: new Date() > dueDateObj ? "overdue" : "pending",
      });
    }
  }

  // Drop installments beyond the new count — but ONLY if they're unpaid.
  // Paid installments are always preserved as history, regardless of count changes.
  for (const [num, doc] of existingByNumber.entries()) {
    if (!keepNumbers.has(num) && doc.paidAmount === 0) {
      await FeeInstallment.deleteOne({ _id: doc._id });
    }
  }
};

const recalculateFeeTotals = async (studentId) => {
  const fee = await Fee.findOne({ student: studentId });
  if (!fee) return null;

  const successfulPayments = await Payment.find({
    student: studentId,
    paymentStatus: "success",
  });
  const totalPaid = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

  fee.totalPaid = totalPaid;

  if (fee.paymentMode === "emi") {
    // ── Next due date is always derived from the earliest unpaid/partial/
    // overdue installment — never a manually maintained duplicate value. ──
    const nextInstallment = await FeeInstallment.findOne({
      student: studentId,
      status: { $in: ["pending", "partial", "overdue"] },
    }).sort({ dueDate: 1 });
    fee.nextDueDate = nextInstallment ? nextInstallment.dueDate : null;
  } else {
    // ── Full payment mode — keep the existing auto-advance-by-one-month
    // behavior for the manually-set due date. ──
    const remaining = Math.max((fee.finalFee || fee.totalFees) - totalPaid, 0);

    if (remaining <= 0) {
      fee.nextDueDate = null;
    } else if (fee.nextDueDate) {
      const now = new Date();
      const due = new Date(fee.nextDueDate);

      if (due <= now) {
        const next = new Date(due);
        next.setMonth(next.getMonth() + 1);
        fee.nextDueDate = next;
      }
    }
  }

  await fee.save(); // triggers pre-save → feeStatus recalculation
  return fee;
};

const getNextPaymentNumber = async (studentId) => {
  const last = await Payment.findOne({ student: studentId }).sort({ paymentNumber: -1 });
  return last ? last.paymentNumber + 1 : 1;
};

// ── Apply a payment amount across unpaid installments, oldest first ──────
// Never modifies an installment that's already fully paid, and never
// removes history.
const applyPaymentToInstallments = async (studentId, paymentAmount, paymentId) => {
  let remaining = paymentAmount;

  const unpaidInstallments = await FeeInstallment.find({
    student: studentId,
    status: { $in: ["pending", "partial", "overdue"] },
  }).sort({ installmentNumber: 1 });

  for (const inst of unpaidInstallments) {
    if (remaining <= 0) break;
    const toApply = Math.min(remaining, inst.amount - inst.paidAmount);
    if (toApply <= 0) continue;
    inst.paidAmount += toApply;
    inst.payments.push(paymentId);
    remaining -= toApply;
    await inst.save(); // pre-save hook recomputes status/remainingAmount/paidDate
  }
};

// ── LEGACY: kept for backward compatibility with any other caller, but
// setupFee no longer calls this — the frontend now sends an explicit
// `installments` array which is handled by syncEmiInstallments() above. ──
const regenerateInstallmentsForFee = async (fee, studentId) => {
  if (!fee) return;

  if (fee.paymentMode !== "emi" || !fee.emiMonths) {
    // Switched away from EMI (or no months set) — drop only the untouched,
    // fully-unpaid installments. Anything with a payment stays as history.
    await FeeInstallment.deleteMany({ student: studentId, paidAmount: 0 });
    return;
  }

  const existing = await FeeInstallment.find({ student: studentId }).sort({ installmentNumber: 1 });
  const preserved = existing.filter((i) => i.paidAmount > 0);
  const toRemove = existing.filter((i) => i.paidAmount === 0);

  if (toRemove.length) {
    await FeeInstallment.deleteMany({ _id: { $in: toRemove.map((d) => d._id) } });
  }

  const preservedTotal = preserved.reduce((sum, i) => sum + i.amount, 0);
  const remainingAmount = Math.max((fee.finalFee || fee.totalFees) - preservedTotal, 0);
  const remainingMonths = Math.max(fee.emiMonths - preserved.length, 0);

  if (remainingMonths <= 0 || remainingAmount <= 0) return;

  const monthlyAmount = Math.round((remainingAmount / remainingMonths) * 100) / 100;

  let startDate;
  if (preserved.length > 0) {
    startDate = new Date(preserved[preserved.length - 1].dueDate);
    startDate.setMonth(startDate.getMonth() + 1);
  } else {
    startDate = fee.nextDueDate ? new Date(fee.nextDueDate) : new Date();
  }

  const docs = [];
  for (let i = 0; i < remainingMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    docs.push({
      fee: fee._id,
      student: studentId,
      installmentNumber: preserved.length + i + 1,
      dueDate,
      amount: monthlyAmount,
      paidAmount: 0,
      remainingAmount: monthlyAmount,
      status: new Date() > dueDate ? "overdue" : "pending",
    });
  }

  if (docs.length) await FeeInstallment.insertMany(docs);
};

// POST/PUT /api/admin/students/:id/fee
// const setupFee = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       totalFees,
//       paymentMode,
//       emiMonths,
//       course,
//       payments,
//       nextDueDate, // ← admin-supplied due date (ISO string) — full mode only
//       installments, // ← NEW: array of { installmentNumber, amount, dueDate } — EMI mode only
//     } = req.body;

//     const student = await User.findById(id);
//     if (!student || student.role !== "student") {
//       return res.status(404).json({ success: false, message: "Student Not Found" });
//     }

//     if (!totalFees || Number(totalFees) <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Total fees must be greater than 0",
//       });
//     }
//     if (!["full", "emi"].includes(paymentMode)) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment mode must be 'full' or 'emi'",
//       });
//     }

//     let normalizedInstallments = [];

//     if (paymentMode === "emi") {
//       const months = Number(emiMonths);
//       if (!months || months < 1) {
//         return res.status(400).json({
//           success: false,
//           message: "Number of EMI must be at least 1",
//         });
//       }

//       if (!Array.isArray(installments) || installments.length !== months) {
//         return res.status(400).json({
//           success: false,
//           message: "Number of installments provided does not match the number of EMI",
//         });
//       }

//       // ── Never trust frontend totals — validate every installment server-side. ──
//       let runningSum = 0;

//       for (let i = 0; i < installments.length; i++) {
//         const inst = installments[i] || {};
//         const amount = Number(inst.amount);
//         const dueDateObj = new Date(inst.dueDate);

//         if (!amount || amount <= 0) {
//           return res.status(400).json({
//             success: false,
//             message: `EMI ${i + 1}: amount must be greater than 0`,
//           });
//         }
//         if (!inst.dueDate || isNaN(dueDateObj.getTime())) {
//           return res.status(400).json({
//             success: false,
//             message: `EMI ${i + 1}: a valid due date is required`,
//           });
//         }

//         runningSum += amount;
//         normalizedInstallments.push({ amount, dueDate: dueDateObj });
//       }

//       runningSum = Math.round(runningSum * 100) / 100;
//       const totalRounded = Math.round(Number(totalFees) * 100) / 100;

//       if (runningSum !== totalRounded) {
//         return res.status(400).json({
//           success: false,
//           message: `EMI amounts must total ₹${totalRounded.toLocaleString(
//             "en-IN"
//           )}. Current total is ₹${runningSum.toLocaleString("en-IN")}.`,
//         });
//       }
//     }

//     // ── Resolve due date (full-payment mode only; EMI mode derives it from
//     // the installment schedule via recalculateFeeTotals) ────────────────────
//     let resolvedDueDate = null;

//     if (paymentMode === "full") {
//       if (nextDueDate) {
//         const parsed = new Date(nextDueDate);
//         if (!isNaN(parsed.getTime())) {
//           resolvedDueDate = parsed;
//         }
//       } else {
//         const defaultDue = new Date();
//         defaultDue.setMonth(defaultDue.getMonth() + 1);
//         defaultDue.setHours(0, 0, 0, 0);
//         resolvedDueDate = defaultDue;
//       }
//     }

//     let fee = await Fee.findOne({ student: id });

//     if (fee) {
//       fee.totalFees = totalFees;
//       fee.paymentMode = paymentMode;
//       fee.emiMonths = paymentMode === "emi" ? Number(emiMonths) : null;
//       if (course) fee.course = course;
//       fee.createdBy = req.user.id;

//       if (paymentMode === "full" && (nextDueDate || !fee.nextDueDate)) {
//         fee.nextDueDate = resolvedDueDate;
//       }
//     } else {
//       fee = new Fee({
//         student: id,
//         course: course || null,
//         totalFees,
//         paymentMode,
//         emiMonths: paymentMode === "emi" ? Number(emiMonths) : null,
//         nextDueDate: paymentMode === "full" ? resolvedDueDate : null,
//         createdBy: req.user.id,
//       });
//     }
//     await fee.save();

//     if (Array.isArray(payments) && payments.length > 0) {
//       let nextNumber = await getNextPaymentNumber(id);
//       const docs = payments
//         .filter((p) => p.amount && Number(p.amount) > 0)
//         .map((p) => ({
//           student: id,
//           fee: fee._id,
//           course: course || fee.course || null,
//           paymentNumber: nextNumber++,
//           amount: Number(p.amount),
//           paymentMethod: p.paymentMethod || "UPI",
//           transactionId: p.transactionId || null,
//           paymentStatus: "success",
//           paidAt: p.paidAt || new Date(),
//           recordedBy: req.user.id,
//         }));

//       if (docs.length > 0) await Payment.insertMany(docs);
//     }

//     // ── Persist the EMI schedule (or clean it up if switching to full) ──────
//     // if (paymentMode === "emi") {
//     //   await syncEmiInstallments(fee, id, normalizedInstallments);
//     // } else {
//     //   // Switched to full payment — drop only untouched (unpaid) installments;
//     //   // anything with a payment recorded stays as history.
//     //   await FeeInstallment.deleteMany({ student: id, paidAmount: 0 });
//     // }

//     // const updatedFee = await recalculateFeeTotals(id);


//     if (paymentMode === "emi") {
//       await syncEmiInstallments(fee, id, normalizedInstallments);
//       await reconcilePaymentsToInstallments(id, fee._id, { recalcFee: false });
//     } else {
//       await FeeInstallment.deleteMany({ student: id, paidAmount: 0 });
//     }

//     const updatedFee = await recalculateFeeTotals(id);

//     return res.status(200).json({
//       success: true,
//       message: "Fee plan saved successfully",
//       data: updatedFee,
//     });
//   } catch (error) {
//     console.error("setupFee error:", error);
//     if (error.name === "ValidationError") {
//       const message = Object.values(error.errors)
//         .map((e) => e.message)
//         .join(". ");
//       return res.status(400).json({ success: false, message });
//     }
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

const setupFee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      totalFees,
      paymentMode,
      emiMonths,
      course,
      payments,
      nextDueDate,
      installments,
      registrationPayment, // NEW: { amount, paymentMethod, transactionId, paidAt }
    } = req.body;

    const student = await User.findById(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student Not Found" });
    }
    if (!totalFees || Number(totalFees) <= 0) {
      return res.status(400).json({ success: false, message: "Total fees must be greater than 0" });
    }
    if (!["full", "emi"].includes(paymentMode)) {
      return res.status(400).json({ success: false, message: "Payment mode must be 'full' or 'emi'" });
    }

    // ── NEW: Registration / Admission / Initial payment ───────────────────────
    // Never duplicated: if one already exists for this student, we reuse its
    // amount for the EMI math and simply don't create another Payment doc.
    const existingRegistrationPayment = await Payment.findOne({
      student: id,
      isRegistrationPayment: true,
      paymentStatus: "success",
    });

    let registrationAmountToDeduct = existingRegistrationPayment
      ? existingRegistrationPayment.amount
      : 0;

    const wantsNewRegistrationPayment =
      !existingRegistrationPayment &&
      registrationPayment &&
      Number(registrationPayment.amount) > 0;

    if (wantsNewRegistrationPayment) {
      const regAmount = Number(registrationPayment.amount);
      if (regAmount > Number(totalFees)) {
        return res.status(400).json({
          success: false,
          message: "Registration/initial payment cannot be greater than the total course fee",
        });
      }
      registrationAmountToDeduct = regAmount;
    }

    const payableAfterRegistration = Math.max(Number(totalFees) - registrationAmountToDeduct, 0);

    let normalizedInstallments = [];

    if (paymentMode === "emi") {
      const months = Number(emiMonths);
      if (!months || months < 1) {
        return res.status(400).json({ success: false, message: "Number of EMI must be at least 1" });
      }
      if (!Array.isArray(installments) || installments.length !== months) {
        return res.status(400).json({
          success: false,
          message: "Number of installments provided does not match the number of EMI",
        });
      }

      let runningSum = 0;
      for (let i = 0; i < installments.length; i++) {
        const inst = installments[i] || {};
        const amount = Number(inst.amount);
        const dueDateObj = new Date(inst.dueDate);
        if (!amount || amount <= 0) {
          return res.status(400).json({ success: false, message: `EMI ${i + 1}: amount must be greater than 0` });
        }
        if (!inst.dueDate || isNaN(dueDateObj.getTime())) {
          return res.status(400).json({ success: false, message: `EMI ${i + 1}: a valid due date is required` });
        }
        runningSum += amount;
        normalizedInstallments.push({ amount, dueDate: dueDateObj });
      }

      runningSum = Math.round(runningSum * 100) / 100;
      const payableRounded = Math.round(payableAfterRegistration * 100) / 100;

      if (runningSum !== payableRounded) {
        return res.status(400).json({
          success: false,
          message: `EMI amounts must total ₹${payableRounded.toLocaleString("en-IN")} (Total Fee minus Registration/Initial Payment). Current total is ₹${runningSum.toLocaleString("en-IN")}.`,
        });
      }
    }

    // ── Resolve due date (full mode only, unchanged) ───────────────────────────
    let resolvedDueDate = null;
    if (paymentMode === "full") {
      if (nextDueDate) {
        const parsed = new Date(nextDueDate);
        if (!isNaN(parsed.getTime())) resolvedDueDate = parsed;
      } else {
        const defaultDue = new Date();
        defaultDue.setMonth(defaultDue.getMonth() + 1);
        defaultDue.setHours(0, 0, 0, 0);
        resolvedDueDate = defaultDue;
      }
    }

    let fee = await Fee.findOne({ student: id });
    if (fee) {
      fee.totalFees = totalFees;
      fee.paymentMode = paymentMode;
      fee.emiMonths = paymentMode === "emi" ? Number(emiMonths) : null;
      if (course) fee.course = course;
      fee.createdBy = req.user.id;
      if (paymentMode === "full" && (nextDueDate || !fee.nextDueDate)) {
        fee.nextDueDate = resolvedDueDate;
      }
    } else {
      fee = new Fee({
        student: id,
        course: course || null,
        totalFees,
        paymentMode,
        emiMonths: paymentMode === "emi" ? Number(emiMonths) : null,
        nextDueDate: paymentMode === "full" ? resolvedDueDate : null,
        createdBy: req.user.id,
      });
    }
    await fee.save();

    // ── Record the registration/initial payment exactly once ───────────────────
    if (wantsNewRegistrationPayment) {
      const paymentNumber = await getNextPaymentNumber(id);
      await Payment.create({
        student: id,
        fee: fee._id,
        course: course || fee.course || null,
        paymentNumber,
        amount: Number(registrationPayment.amount),
        paymentMethod: registrationPayment.paymentMethod || "UPI",
        transactionId: registrationPayment.transactionId || null,
        paymentStatus: "success",
        paidAt: registrationPayment.paidAt ? new Date(registrationPayment.paidAt) : new Date(),
        recordedBy: req.user.id,
        isRegistrationPayment: true,
        notes: "Registration / Admission / Initial Payment",
      });
    }

    if (Array.isArray(payments) && payments.length > 0) {
      let nextNumber = await getNextPaymentNumber(id);
      const docs = payments
        .filter((p) => p.amount && Number(p.amount) > 0)
        .map((p) => ({
          student: id,
          fee: fee._id,
          course: course || fee.course || null,
          paymentNumber: nextNumber++,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod || "UPI",
          transactionId: p.transactionId || null,
          paymentStatus: "success",
          paidAt: p.paidAt || new Date(),
          recordedBy: req.user.id,
        }));
      if (docs.length > 0) await Payment.insertMany(docs);
    }

    if (paymentMode === "emi") {
      await syncEmiInstallments(fee, id, normalizedInstallments);
      await reconcilePaymentsToInstallments(id, fee._id, { recalcFee: false });
    } else {
      await FeeInstallment.deleteMany({ student: id, paidAmount: 0 });
    }

    const updatedFee = await recalculateFeeTotals(id);

    return res.status(200).json({
      success: true,
      message: "Fee plan saved successfully",
      data: updatedFee,
    });
  } catch (error) {
    console.error("setupFee error:", error);
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/admin/students/:id/fee
const getFeeByStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const fee = await Fee.findOne({ student: id }).populate("course", "title price");
    const payments = await Payment.find({ student: id }).sort({ paymentNumber: 1 });
    return res.status(200).json({ success: true, data: fee, payments });
  } catch (error) {
    console.error("getFeeByStudent error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/student/fee
const getMyFee = async (req, res) => {
  try {
    const fee = await Fee.findOne({ student: req.user.id }).populate("course", "title price");
    const payments = await Payment.find({
      student: req.user.id,
      paymentStatus: "success",
    }).sort({ paymentNumber: 1 });
    return res.status(200).json({ success: true, data: fee, payments });
  } catch (error) {
    console.error("getMyFee error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ── Fee-based login eligibility check (students only) ─────────────────────────
const checkFeeLoginEligibility = async (studentId) => {
  const fee = await Fee.findOne({ student: studentId });

  console.log("LOGIN FEE CHECK:", {
    studentId,
    fee
  });

  if (!fee) {
    return {
      blocked: true,
      feeStatus: "no-plan",
      message:
        "Your fee plan is not created. Please contact admin."
    };
  }

  if (
    fee.feeStatus === "paid" ||
    fee.remainingAmount <= 0
  ) {
    return {
      blocked: false,
      feeStatus: fee.feeStatus,
      remainingAmount: fee.remainingAmount,
      nextDueDate: fee.nextDueDate,
    };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const paidThisMonth = await Payment.findOne({
    student: studentId,
    paymentStatus: "success",
    paidAt: { $gte: monthStart, $lte: monthEnd },
  });

  if (paidThisMonth) {
    return {
      blocked: false,
      feeStatus: fee.feeStatus,
      remainingAmount: fee.remainingAmount,
      nextDueDate: fee.nextDueDate,
    };
  }

  return {
    blocked: true,
    feeStatus: fee.feeStatus,
    totalFees: fee.finalFee,
    totalPaid: fee.totalPaid,
    remainingAmount: fee.remainingAmount,
    nextDueDate: fee.nextDueDate,
    message:
      "Your fee payment is overdue. Please clear your pending dues to continue accessing your account.",
  };
};

// ── GET /api/admin/students/:id/fee/installments ────────────────────────────
const getInstallments = async (req, res) => {
  try {
    const { id } = req.params;
    const installments = await FeeInstallment.find({ student: id })
      .sort({ installmentNumber: 1 })
      .populate("payments", "amount paidAt paymentMethod");
    return res.status(200).json({ success: true, data: installments });
  } catch (error) {
    console.error("getInstallments error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ── LEGACY: standalone add/update/delete EMI endpoints — kept only for
// backward compatibility. The Student Details Fee section no longer uses
// these; EMI plans are created/edited exclusively through setupFee(). ──────
const addInstallment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, dueDate } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }
    if (!dueDate) {
      return res.status(400).json({ success: false, message: "Due date is required" });
    }

    const fee = await Fee.findOne({ student: id });
    if (!fee) {
      return res.status(404).json({ success: false, message: "No fee plan found for this student" });
    }
    if (fee.paymentMode !== "emi") {
      return res.status(400).json({
        success: false,
        message: "EMI schedule is only available when the payment mode is set to EMI",
      });
    }

    const last = await FeeInstallment.findOne({ student: id }).sort({ installmentNumber: -1 });
    const nextNumber = last ? last.installmentNumber + 1 : 1;
    const dueDateObj = new Date(dueDate);

    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid due date" });
    }

    const installment = await FeeInstallment.create({
      fee: fee._id,
      student: id,
      installmentNumber: nextNumber,
      dueDate: dueDateObj,
      amount: Number(amount),
      paidAmount: 0,
      remainingAmount: Number(amount),
      status: new Date() > dueDateObj ? "overdue" : "pending",
    });

    fee.emiMonths = (fee.emiMonths || 0) + 1;
    await fee.save();

    return res.status(201).json({ success: true, message: "EMI added successfully", data: installment });
  } catch (error) {
    console.error("addInstallment error:", error);
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const updateInstallment = async (req, res) => {
  try {
    const { id, installmentId } = req.params;
    const { amount, dueDate } = req.body;

    const installment = await FeeInstallment.findOne({ _id: installmentId, student: id });
    if (!installment) {
      return res.status(404).json({ success: false, message: "EMI installment not found" });
    }

    if (installment.paidAmount > 0) {
      return res.status(400).json({
        success: false,
        message: "This EMI already has a payment recorded against it and cannot be modified",
      });
    }

    if (amount !== undefined) {
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
      }
      installment.amount = Number(amount);
    }

    if (dueDate !== undefined) {
      const dueDateObj = new Date(dueDate);
      if (isNaN(dueDateObj.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid due date" });
      }
      installment.dueDate = dueDateObj;
    }

    await installment.save();

    return res.status(200).json({ success: true, message: "EMI updated successfully", data: installment });
  } catch (error) {
    console.error("updateInstallment error:", error);
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteInstallment = async (req, res) => {
  try {
    const { id, installmentId } = req.params;

    const installment = await FeeInstallment.findOne({ _id: installmentId, student: id });
    if (!installment) {
      return res.status(404).json({ success: false, message: "EMI installment not found" });
    }

    if (installment.paidAmount > 0) {
      return res.status(400).json({
        success: false,
        message: "This EMI already has a payment recorded against it and cannot be deleted",
      });
    }

    await FeeInstallment.deleteOne({ _id: installmentId });

    const fee = await Fee.findOne({ student: id });
    if (fee && fee.emiMonths > 0) {
      fee.emiMonths = Math.max(fee.emiMonths - 1, 0);
      await fee.save();
    }

    return res.status(200).json({ success: true, message: "EMI deleted successfully" });
  } catch (error) {
    console.error("deleteInstallment error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  setupFee,
  getFeeByStudent,
  getMyFee,
  recalculateFeeTotals,
  getNextPaymentNumber,
  checkFeeLoginEligibility,
  applyPaymentToInstallments,
  regenerateInstallmentsForFee,
  syncEmiInstallments,
  getInstallments,
  addInstallment,
  updateInstallment,
  deleteInstallment,
};
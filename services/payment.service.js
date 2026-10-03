const mongoose = require("mongoose");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const FeeInstallment = require("../models/FeeInstallment");
const ActivityLog = require("../models/ActivityLog");
const { reconcilePaymentsToInstallments } = require("./feeReconciliation.service");

const EPS = 0.01;
const VALID_METHODS = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "PaymentError";
    this.statusCode = statusCode;
  }
}

const roundMoney = (n) => Math.round(n * 100) / 100;

const generateReceiptNumber = (fee) => {
  const year = new Date().getFullYear();
  const next = (fee.lastReceiptNumber || 0) + 1;
  fee.lastReceiptNumber = next;
  return `${fee.receiptPrefix || "deepScode"}-${year}-${String(next).padStart(4, "0")}`;
};

const getNextPaymentNumber = async (studentId) => {
  const last = await Payment.findOne({ student: studentId }).sort({ paymentNumber: -1 });
  return last ? last.paymentNumber + 1 : 1;
};

// Recomputes Fee.totalPaid / nextDueDate from ground truth (successful
// payments + installments) — never trusts incremental bookkeeping.
const recalculateFee = async (studentId) => {
  const fee = await Fee.findOne({ student: studentId });
  if (!fee) return null;

  const successfulPayments = await Payment.find({ student: studentId, paymentStatus: "success" });
  fee.totalPaid = roundMoney(successfulPayments.reduce((s, p) => s + p.amount, 0));

  if (fee.paymentMode === "emi") {
    const nextInstallment = await FeeInstallment.findOne({
      student: studentId,
      status: { $in: ["pending", "partial", "overdue"] },
    }).sort({ dueDate: 1 });
    fee.nextDueDate = nextInstallment ? nextInstallment.dueDate : null;
  } else {
    const remaining = Math.max((fee.finalFee || fee.totalFees) - fee.totalPaid, 0);
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

  await fee.save(); // triggers pre-save → feeStatus recompute
  return fee;
};

/**
 * Applies a payment to ONE specific, admin-selected installment.
 * Never cascades into any other installment.
 */
const applyPaymentToSpecificInstallment = async (studentId, installmentId, paymentAmount, paymentDoc) => {
  const inst = await FeeInstallment.findOne({ _id: installmentId, student: studentId });
  if (!inst) throw new PaymentError("Selected EMI installment not found", 404);

  if (inst.status === "paid" || inst.remainingAmount <= EPS) {
    throw new PaymentError("This EMI is already fully paid — choose a different EMI.", 400);
  }

  if (paymentAmount > inst.remainingAmount + EPS) {
    throw new PaymentError(
      `Amount (₹${paymentAmount.toLocaleString("en-IN")}) exceeds the remaining balance of ₹${inst.remainingAmount.toLocaleString(
        "en-IN"
      )} for EMI #${inst.installmentNumber}. It cannot spill over into another EMI.`,
      400
    );
  }

  inst.paidAmount = roundMoney(inst.paidAmount + paymentAmount);
  inst.payments.push(paymentDoc._id);

  if (inst.paidAmount >= inst.amount - EPS && !inst.paidDate) {
    inst.paidDate = paymentDoc.paidAt;
  }

  await inst.save(); // pre-save hook recomputes remainingAmount + status
  return inst;
};

/**
 * recordPayment(studentId, payload, recordedByUserId)
 */
const recordPayment = async (studentId, payload, recordedByUserId) => {
  const {
    amount,
    paymentMethod = "UPI",
    transactionId,
    paidAt,
    notes = "",
    installmentId,
    branch = null,
  } = payload;

  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) {
    throw new PaymentError("Amount must be greater than 0");
  }

  const method = paymentMethod || "UPI";
  if (!VALID_METHODS.includes(method)) {
    throw new PaymentError(`Payment method must be one of: ${VALID_METHODS.join(", ")}`);
  }

  const fee = await Fee.findOne({ student: studentId });
  if (!fee) {
    throw new PaymentError("No fee plan found. Set up a fee plan first before recording payments.");
  }

  let installment = null;
  if (fee.paymentMode === "emi") {
    if (!installmentId) {
      throw new PaymentError("Please select which EMI this payment is for.");
    }
    installment = await FeeInstallment.findOne({ _id: installmentId, student: studentId });
    if (!installment) throw new PaymentError("Selected EMI installment not found", 404);

    if (installment.status === "paid" || installment.remainingAmount <= EPS) {
      throw new PaymentError("This EMI is already fully paid — choose a different EMI.");
    }
    if (numericAmount > installment.remainingAmount + EPS) {
      throw new PaymentError(
        `Amount exceeds the remaining balance of ₹${installment.remainingAmount.toLocaleString(
          "en-IN"
        )} for EMI #${installment.installmentNumber}.`
      );
    }
  }

  const resolvedPaidAt = paidAt ? new Date(paidAt) : new Date();
  if (isNaN(resolvedPaidAt.getTime())) {
    throw new PaymentError("Invalid payment date");
  }

  const receiptNumber = generateReceiptNumber(fee);
  const paymentNumber = await getNextPaymentNumber(studentId);

  const payment = await Payment.create({
    student: studentId,
    fee: fee._id,
    course: fee.course || null,
    installment: installment ? installment._id : null,
    paymentNumber,
    amount: numericAmount,
    paymentMethod: method,
    transactionId: transactionId || null,
    paymentStatus: "success",
    paidAt: resolvedPaidAt,
    recordedBy: recordedByUserId,
    receiptNumber,
    notes,
    branch,
  });

  if (installment) {
    await applyPaymentToSpecificInstallment(studentId, installment._id, numericAmount, payment);
  }

  await fee.save(); // persist the incremented lastReceiptNumber
  const updatedFee = await recalculateFee(studentId);

  const populatedPayment = await Payment.findById(payment._id)
    .populate("recordedBy", "fullName")
    .populate("course", "title");

  return { payment: populatedPayment, fee: updatedFee };
};

/**
 * deletePayment(paymentId, actingUser)
 *
 * Deletes the Payment, then fully reconciles everything that depended on
 * it — reusing reconcilePaymentsToInstallments() (feeReconciliation.service.js)
 * so installment paidAmount/remainingAmount/status/payments[] are always
 * rebuilt FROM the successful Payment records that remain, never patched
 * incrementally off the old stored value. This is what makes the fix
 * correct even when an installment has multiple payments.
 */
const deletePayment = async (paymentId, actingUser) => {
  let session = null;
  let useTransaction = true;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {}); // probe support
  } catch (_) {
    useTransaction = false;
    session = null;
  }

  const run = async (s) => {
    const payment = await Payment.findById(paymentId).session(s || null);
    if (!payment) throw new PaymentError("Payment not found", 404);

    const studentId = payment.student;
    const feeId = payment.fee;
    const installmentId = payment.installment;

    // Delete the payment FIRST. Everything below re-derives its numbers
    // purely from whatever Payment documents remain — so the deleted
    // payment must already be gone before reconciliation runs.
    await Payment.deleteOne({ _id: payment._id }).session(s || null);

    let updatedFee = null;

    if (feeId) {
      const fee = await Fee.findById(feeId).session(s || null);
      if (fee && fee.paymentMode === "emi") {
        // Rebuilds EVERY installment's paidAmount/remainingAmount/status/
        // payments[] from the remaining successful Payments, then
        // recalculates Fee.totalPaid / nextDueDate.
        const result = await reconcilePaymentsToInstallments(studentId, feeId, {
          session: s || undefined,
          recalcFee: true,
        });
        updatedFee = (result && result.fee) || (await recalculateFee(studentId));
      } else if (fee) {
        updatedFee = await recalculateFee(studentId);
      } else {
        updatedFee = await recalculateFee(studentId);
      }
    } else {
      updatedFee = await recalculateFee(studentId);
    }

    // Best-effort — must never block or roll back a successful deletion.
    try {
      await ActivityLog.create(
        [
          {
            userId: actingUser?.id,
            userName: actingUser?.fullName || actingUser?.name || "Super Admin",
            userRole: actingUser?.role,
            action: "super_admin.payment.deleted",
            resource: "Payment",
            resourceId: String(payment._id),
            description: `Deleted payment #${payment.paymentNumber} (₹${payment.amount}) for student ${studentId}`,
            metadata: {
              amount: payment.amount,
              paymentMethod: payment.paymentMethod,
              installmentId: installmentId ? String(installmentId) : null,
              receiptNumber: payment.receiptNumber || null,
              wasRegistrationPayment: !!payment.isRegistrationPayment,
            },
          },
        ],
        { session: s || undefined }
      );
    } catch (logErr) {
      console.error("[deletePayment] activity log failed:", logErr.message);
    }

    return { deletedPaymentId: String(payment._id), fee: updatedFee };
  };

  try {
    if (useTransaction) {
      let result;
      await session.withTransaction(async () => {
        result = await run(session);
      });
      return result;
    }
    return await run(null);
  } finally {
    if (session) session.endSession();
  }
};

module.exports = {
  PaymentError,
  recordPayment,
  recalculateFee,
  applyPaymentToSpecificInstallment,
  deletePayment,
};
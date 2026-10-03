const mongoose = require("mongoose");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const FeeInstallment = require("../models/FeeInstallment");

const EPSILON = 0.009; // paise-level rounding tolerance

const roundMoney = (n) => Math.round(n * 100) / 100;

async function recalcFeeTotalsFromInstallments(fee, session, logger) {
  const successfulPayments = await Payment.find({
    student: fee.student,
    paymentStatus: "success",
  }).session(session);

  const totalPaid = roundMoney(successfulPayments.reduce((s, p) => s + p.amount, 0));

  const nextInstallment = await FeeInstallment.findOne({
    fee: fee._id,
    student: fee.student,
    status: { $in: ["pending", "partial", "overdue"] },
  })
    .sort({ dueDate: 1 })
    .session(session);

  fee.totalPaid = totalPaid;
  fee.nextDueDate = nextInstallment ? nextInstallment.dueDate : null;
  await fee.save({ session });

  logger.info(
    `[reconcile] Fee totals updated — fee=${fee._id} totalPaid=${totalPaid} nextDueDate=${fee.nextDueDate}`
  );

  return fee;
}

async function reconcilePaymentsToInstallments(studentId, feeId, opts = {}) {
  const { session = null, dryRun = false, recalcFee = true, logger = console } = opts;

  const fee = await Fee.findById(feeId).session(session);
  if (!fee) throw new Error(`Fee not found: ${feeId}`);
  if (String(fee.student) !== String(studentId)) {
    throw new Error(`Fee ${feeId} does not belong to student ${studentId}`);
  }
  if (fee.paymentMode !== "emi") {
    logger.info(`[reconcile] Skipping fee ${feeId} — paymentMode is "${fee.paymentMode}", not "emi".`);
    return { skipped: true, reason: "not-emi", feeId: String(feeId), studentId: String(studentId) };
  }

  const installments = await FeeInstallment.find({ fee: fee._id, student: studentId })
    .sort({ installmentNumber: 1 })
    .session(session);

  if (!installments.length) {
    logger.info(`[reconcile] Skipping fee ${feeId} — no FeeInstallment records exist yet.`);
    return { skipped: true, reason: "no-installments", feeId: String(feeId), studentId: String(studentId) };
  }

  const installmentById = new Map(installments.map((i) => [String(i._id), i]));

  const successfulPayments = await Payment.find({
    student: studentId,
    paymentStatus: "success",
    isRegistrationPayment: { $ne: true },
  })
    .sort({ paidAt: 1, createdAt: 1, paymentNumber: 1 })
    .session(session);

  const before = {
    studentId: String(studentId),
    feeId: String(fee._id),
    totalSuccessfulPayments: successfulPayments.length,
    totalPaymentAmount: roundMoney(successfulPayments.reduce((s, p) => s + p.amount, 0)),
    totalInstallmentAmount: roundMoney(installments.reduce((s, i) => s + i.amount, 0)),
    existingInstallmentPaidAmountTotal: roundMoney(installments.reduce((s, i) => s + i.paidAmount, 0)),
  };
  logger.info(`[reconcile] BEFORE ${JSON.stringify(before)}`);

  const allocatedSoFar = new Map(installments.map((i) => [String(i._id), 0]));
  const contributionsByInstallment = new Map(installments.map((i) => [String(i._id), []]));
  const paymentIdsByInstallment = new Map(installments.map((i) => [String(i._id), []]));
  let overflowAmount = 0;

  const addContribution = (key, payment, toApply) => {
    allocatedSoFar.set(key, roundMoney(allocatedSoFar.get(key) + toApply));
    contributionsByInstallment.get(key).push({
      paymentId: payment._id,
      amount: toApply,
      paidAt: payment.paidAt || payment.createdAt,
    });
    const ids = paymentIdsByInstallment.get(key);
    if (!ids.some((id) => String(id) === String(payment._id))) ids.push(payment._id);
  };

  // ── Split: payments explicitly tied to a (still-existing) installment
  // are NEVER moved. Everything else (legacy, or pointing at a deleted
  // installment) falls back to the old earliest-first cascade. ──────────────
  const explicitPayments = successfulPayments.filter(
    (p) => p.installment && installmentById.has(String(p.installment))
  );
  const legacyPayments = successfulPayments.filter(
    (p) => !p.installment || !installmentById.has(String(p.installment))
  );

  // Phase 1 — pinned allocations
  for (const payment of explicitPayments) {
    const key = String(payment.installment);
    const inst = installmentById.get(key);
    const capacity = Math.max(inst.amount - allocatedSoFar.get(key), 0);
    const toApply = roundMoney(Math.min(payment.amount, capacity));

    if (toApply < payment.amount - EPSILON) {
      // Should not normally happen (validated at creation time), but if the
      // installment's amount was edited down afterward, flag the overflow
      // instead of silently discarding or misallocating it.
      overflowAmount = roundMoney(overflowAmount + (payment.amount - toApply));
    }
    if (toApply > 0) addContribution(key, payment, toApply);
  }

  // Phase 2 — legacy cascade (oldest payment first, earliest unpaid installment first)
  for (const payment of legacyPayments) {
    let remaining = payment.amount;

    for (let idx = 0; idx < installments.length && remaining > EPSILON; idx++) {
      const inst = installments[idx];
      const key = String(inst._id);
      const capacity = inst.amount - allocatedSoFar.get(key);
      if (capacity <= EPSILON) continue;

      const toApply = roundMoney(Math.min(remaining, capacity));
      if (toApply <= 0) continue;

      addContribution(key, payment, toApply);
      remaining = roundMoney(remaining - toApply);
    }

    if (remaining > EPSILON) overflowAmount = roundMoney(overflowAmount + remaining);
  }

  const now = new Date();
  const updates = [];
  const afterSummary = [];

  for (const inst of installments) {
    const key = String(inst._id);
    const paidAmount = roundMoney(allocatedSoFar.get(key));
    const remainingAmount = Math.max(roundMoney(inst.amount - paidAmount), 0);

    let status;
    if (paidAmount >= inst.amount - EPSILON) status = "paid";
    else if (paidAmount > 0) status = now > new Date(inst.dueDate) ? "overdue" : "partial";
    else status = now > new Date(inst.dueDate) ? "overdue" : "pending";

    let paidDate = null;
    if (status === "paid") {
      let running = 0;
      for (const c of contributionsByInstallment.get(key)) {
        running = roundMoney(running + c.amount);
        if (running >= inst.amount - EPSILON) {
          paidDate = c.paidAt;
          break;
        }
      }
      if (!paidDate) paidDate = inst.paidDate || now;
    }

    updates.push({
      instId: inst._id,
      set: {
        paidAmount,
        remainingAmount,
        status,
        paidDate,
        payments: paymentIdsByInstallment.get(key),
      },
    });

    afterSummary.push({
      installmentNumber: inst.installmentNumber,
      amount: inst.amount,
      paidAmount,
      remainingAmount,
      status,
      paymentRefCount: paymentIdsByInstallment.get(key).length,
    });
  }

  logger.info(`[reconcile] AFTER (computed) ${JSON.stringify(afterSummary)}`);

  if (overflowAmount > 0) {
    logger.warn(
      `[reconcile] AMBIGUOUS — student=${studentId} fee=${feeId}: ₹${overflowAmount} in successful ` +
        `payments could not be allocated (exceeds the total EMI schedule, or an explicit link points ` +
        `at an installment whose amount changed). Flag for manual review.`
    );
  }

  if (dryRun) {
    return {
      dryRun: true,
      studentId: String(studentId),
      feeId: String(fee._id),
      before,
      after: afterSummary,
      overflow: overflowAmount,
    };
  }

  for (const u of updates) {
    // eslint-disable-next-line no-await-in-loop
    await FeeInstallment.updateOne({ _id: u.instId }, { $set: u.set }, { session });
  }

  let updatedFee = fee;
  if (recalcFee) {
    updatedFee = await recalcFeeTotalsFromInstallments(fee, session, logger);
  }

  return {
    dryRun: false,
    studentId: String(studentId),
    feeId: String(fee._id),
    installmentsUpdated: updates.length,
    paymentsConsidered: successfulPayments.length,
    overflow: overflowAmount,
    after: afterSummary,
    fee: updatedFee,
  };
}

module.exports = { reconcilePaymentsToInstallments, recalcFeeTotalsFromInstallments };
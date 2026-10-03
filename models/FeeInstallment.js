// models/FeeInstallment.js
//
// Per-installment schedule for EMI fee plans.
// One Fee document → many FeeInstallment documents.
// Overdue is computed automatically — never set manually.
//
// Overdue rule (matches spec):
//   remainingAmount > 0  AND  new Date() > dueDate  → status = "overdue"
//
// A virtual `computedStatus` is exposed so controllers and aggregation
// pipelines can derive the current status without an extra DB write.

const mongoose = require("mongoose");

const INSTALLMENT_STATUSES = ["pending", "partial", "paid", "overdue"];

const feeInstallmentSchema = new mongoose.Schema(
  {
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fee",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 1-based installment number (EMI 1, EMI 2, ...)
    installmentNumber: { type: Number, required: true, min: 1 },

    dueDate: { type: Date, required: true },
    paidDate: { type: Date, default: null },

    // Total amount expected for this installment
    amount: { type: Number, required: true, min: 0 },

    // How much of this installment has actually been paid
    paidAmount: { type: Number, default: 0, min: 0 },

    // Derived — but stored for fast queries/aggregations
    // Updated by the payment controller whenever a payment is recorded
    remainingAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: INSTALLMENT_STATUSES,
      default: "pending",
    },

    // Which payment(s) contributed to this installment
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],

    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// ── Pre-save: auto-compute status + remainingAmount ────────────────────────────
feeInstallmentSchema.pre("save", function () {
  this.remainingAmount = Math.max(this.amount - this.paidAmount, 0);

  if (this.paidAmount >= this.amount) {
    this.status = "paid";
    if (!this.paidDate) this.paidDate = new Date();
  } else if (this.paidAmount > 0) {
    const isOverdue = new Date() > new Date(this.dueDate);
    this.status = isOverdue ? "overdue" : "partial";
  } else {
    const isOverdue = new Date() > new Date(this.dueDate);
    this.status = isOverdue ? "overdue" : "pending";
  }
});

// ── Virtual: always-fresh computed status (for API responses) ─────────────────
feeInstallmentSchema.virtual("computedStatus").get(function () {
  if (this.paidAmount >= this.amount) return "paid";
  const isOverdue = new Date() > new Date(this.dueDate);
  if (this.paidAmount > 0) return isOverdue ? "overdue" : "partial";
  return isOverdue ? "overdue" : "pending";
});

feeInstallmentSchema.set("toJSON", { virtuals: true });
feeInstallmentSchema.set("toObject", { virtuals: true });

feeInstallmentSchema.index({ student: 1, installmentNumber: 1 });
feeInstallmentSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model("FeeInstallment", feeInstallmentSchema);
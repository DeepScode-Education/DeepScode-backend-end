
const mongoose = require("mongoose");

const FEE_STATUSES = ["pending", "partial", "paid", "overdue", "no-plan"];

const feeSchema = new mongoose.Schema(
  {
    // ── Existing fields (unchanged) ───────────────────────────────────────────
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    totalFees: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ["full", "emi"], required: true },
    emiMonths: { type: Number, min: 1, default: null },
    monthlyEmiAmount: { type: Number, default: null },
    totalPaid: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ── NEW fields ────────────────────────────────────────────────────────────
    // Discount amount (not percentage — store the rupee value)
    discount: { type: Number, default: 0, min: 0 },

    // finalFee = totalFees - discount  (computed in pre-save)
    finalFee: { type: Number, default: 0, min: 0 },

    // Auto-computed fee status
    feeStatus: {
      type: String,
      enum: FEE_STATUSES,
      default: "pending",
    },

    // Next installment due date — updated by payment controller
    nextDueDate: { type: Date, default: null },

    // Branch of the student (denormalised for fast fee-collection list queries)
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    // Counsellor who manages this student's fee
    counsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Auto-incrementing receipt number prefix  e.g. "deepScode2025-"
    receiptPrefix: { type: String, default: "deepScode" },

    // Last receipt number issued (incremented by payment controller)
    lastReceiptNumber: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ── Pre-save: auto-compute finalFee, remainingAmount, feeStatus ───────────────
feeSchema.pre("save", function () {
  // finalFee
  this.finalFee = Math.max((this.totalFees || 0) - (this.discount || 0), 0);

  // EMI monthly amount
  if (this.paymentMode === "emi" && this.emiMonths) {
    this.monthlyEmiAmount = Math.round((this.finalFee / this.emiMonths) * 100) / 100;
  } else {
    this.monthlyEmiAmount = null;
    this.emiMonths = null;
  }

  // remainingAmount
  this.remainingAmount = Math.max(this.finalFee - (this.totalPaid || 0), 0);

  // feeStatus
  if (!this.totalFees) {
    this.feeStatus = "no-plan";
  } else if (this.remainingAmount <= 0) {
    this.feeStatus = "paid";
  } else if (this.totalPaid > 0) {
    // overdue check — nextDueDate in the past
    if (this.nextDueDate && new Date() > new Date(this.nextDueDate)) {
      this.feeStatus = "overdue";
    } else {
      this.feeStatus = "partial";
    }
  } else {
    if (this.nextDueDate && new Date() > new Date(this.nextDueDate)) {
      this.feeStatus = "overdue";
    } else {
      this.feeStatus = "pending";
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
feeSchema.index({ student: 1 });
feeSchema.index({ feeStatus: 1 });
feeSchema.index({ branch: 1 });
feeSchema.index({ counsellor: 1 });
feeSchema.index({ nextDueDate: 1 });

module.exports = mongoose.model("Fee", feeSchema);

const mongoose = require("mongoose");

const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "Other"];
const PAYMENT_STATUSES = ["pending", "success", "failed"];

const paymentSchema = new mongoose.Schema(
  {
    // ── Existing fields (unchanged) ───────────────────────────────────────────
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fee",
      default: null,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    paymentNumber: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "UPI",
    },
    transactionId: { type: String, trim: true, default: null },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "success",
    },
    paidAt: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    isRegistrationPayment: { type: Boolean, default: false },

    // ── NEW fields ────────────────────────────────────────────────────────────
    // e.g. "deepScode2025-001"
    receiptNumber: { type: String, trim: true, default: null, index: true },

    notes: { type: String, trim: true, default: "" },

    // Branch where payment was collected
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },

    // Which installment this payment goes toward (optional)
    installment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeInstallment",
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
paymentSchema.index({ student: 1, paymentNumber: 1 });
paymentSchema.index({ paidAt: -1 });
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ branch: 1, paidAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);

const User = require("../models/User");
const { PaymentError, recordPayment, deletePayment: deletePaymentService } = require("../services/payment.service");


// POST /api/admin/students/:id/payment
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id);
    if (!student || student.role !== "student") {
      return res.status(404).json({ success: false, message: "Student Not Found" });
    }

    const { payment, fee } = await recordPayment(id, req.body, req.user.id);

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: payment,
      fee,
    });
  } catch (error) {
    console.error("addPayment error:", error);
    if (error instanceof PaymentError) {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((e) => e.message).join(". ");
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/admin/students/:id/payment
const getPaymentsByStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const Payment = require("../models/Payment");
    const Fee = require("../models/Fee");

    const payments = await Payment.find({ student: id })
      .sort({ paymentNumber: 1 })
      .populate("course", "title price");
    const fee = await Fee.findOne({ student: id }).populate("course", "title price");
    return res.status(200).json({ success: true, count: payments.length, data: payments, fee });
  } catch (error) {
    console.error("getPaymentsByStudent error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/student/payment
const getMyPayments = async (req, res) => {
  try {
    const Payment = require("../models/Payment");
    const payments = await Payment.find({
      student: req.user.id,
      paymentStatus: "success",
    })
      .sort({ paymentNumber: 1 })
      .populate("course", "title price");

    return res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    console.error("getMyPayments error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deletePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const result = await deletePaymentService(paymentId, req.user);
    return res.status(200).json({
      success: true,
      message: "Payment deleted and all related records reconciled successfully",
      data: result,
    });
  } catch (error) {
    console.error("deletePayment error:", error);
    if (error instanceof PaymentError) {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { addPayment, getPaymentsByStudent, getMyPayments , deletePayment };
const Enrollment = require("../models/Enrollment");
const Payment = require("../models/Payment");
const Course = require("../models/Course");

const enrollCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course Not Found",
      });
    }

    const alreadyEnrolled =
      await Enrollment.findOne({
        student: req.user.id,
        course: courseId,
      });

    if (alreadyEnrolled) {
      return res.status(400).json({
        success: false,
        message: "Already Enrolled",
      });
    }

    const payment = await Payment.create({
      student: req.user.id,
      course: courseId,
      amount: course.price,
      paymentNumber: 1,
      transactionId:
        "TXN_" + Date.now(),
    });

    const enrollment =
      await Enrollment.create({
        student: req.user.id,
        course: courseId,
      });

    return res.status(201).json({
      success: true,
      message: "Course Purchased Successfully",
      enrollment,
      payment,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  enrollCourse,
};
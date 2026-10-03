const Inquiry    = require("../models/Inquiry");
const Enrollment = require("../models/Enrollment");
const StudentAssignment = require("../models/Studentassignment");
const Payment    = require("../models/Payment");
const User       = require("../models/User");

const getLeadSourceAnalytics = async (req, res) => {
  try {
    const data = await Inquiry.aggregate([
      { $group: { _id: "$source", value: { $sum: 1 } } },
      { $project: { _id: 0, source: "$_id", value: 1 } },
    ]);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.log("lead source analytics error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getCoursePerformance = async (req, res) => {
  try {
    const data = await StudentAssignment.aggregate([
      {
        $lookup: {
          from: "courses",
          localField: "course",
          foreignField: "_id",
          as: "courseData",
        },
      },
      { $unwind: "$courseData" },
      {
        $group: {
          _id: "$courseData.title",
          students: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          course: "$_id",
          students: 1,
          completion: {
            $cond: [
              { $eq: ["$students", 0] },
              0,
              {
                $round: [
                  { $multiply: [{ $divide: ["$completed", "$students"] }, 100] },
                  0,
                ],
              },
            ],
          },
          rating: { $literal: 0 },
        },
      },
    ]);
    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET /api/admin/analytics/revenue-series
// Returns last 12 months of: monthly revenue (successful payments) +
// new student registrations, grouped by calendar month.
const getRevenueSeries = async (req, res) => {
  try {
    // Build the last 12 month buckets (oldest → newest)
    const now   = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year  : d.getFullYear(),
        month : d.getMonth() + 1,            // 1-based
        label : d.toLocaleString("en-IN", { month: "short" }), // "Jan", "Feb"…
      });
    }

    const since = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1
    );

    // Monthly revenue from successful payments
    const revenueAgg = await Payment.aggregate([
      { $match: { paymentStatus: "success", paidAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year  : { $year: "$paidAt" },
            month : { $month: "$paidAt" },
          },
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    // Monthly new student accounts
    const studentAgg = await User.aggregate([
      {
        $match: {
          role: "student",
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            year  : { $year: "$createdAt" },
            month : { $month: "$createdAt" },
          },
          students: { $sum: 1 },
        },
      },
    ]);

    // Index the aggregation results for O(1) lookup
    const revenueMap = {};
    revenueAgg.forEach(({ _id, revenue }) => {
      revenueMap[`${_id.year}-${_id.month}`] = revenue;
    });

    const studentMap = {};
    studentAgg.forEach(({ _id, students }) => {
      studentMap[`${_id.year}-${_id.month}`] = students;
    });

    // Merge into the ordered bucket list
    const data = months.map(({ year, month, label }) => {
      const key = `${year}-${month}`;
      return {
        month   : label,
        revenue : revenueMap[key] || 0,
        students: studentMap[key] || 0,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getRevenueSeries error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  getLeadSourceAnalytics,
  getCoursePerformance,
  getRevenueSeries,
};

const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const FeeInstallment = require("../models/FeeInstallment");
const StudentAssignment = require("../models/Studentassignment");
const send = (res, status, success, message, data, extra = {}) => {
  const body = { success, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

const getFeeCollectionReports = async (req, res) => {
  try {
    // ── Build last 12 month buckets (oldest → newest) ──────────────────────────
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1, // 1-based
        label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      });
    }
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      feeTotalsAgg,
      statusBucketsAgg,
      collectedAgg,
      monthlyCollectedAgg,
      monthlyGeneratedAgg,
      courseWiseAgg,
      counsellorWiseAgg,
      realInstallmentAgg,
      fullModeFeesForVirtualInstallments,
      recentPayments,
    ] = await Promise.all([
      // Total fees generated (all fee plans, ever)
      Fee.aggregate([
        { $group: { _id: null, total: { $sum: "$finalFee" }, count: { $sum: 1 } } },
      ]),

      // Pending / partial / overdue remaining amounts
      Fee.aggregate([
        { $match: { feeStatus: { $in: ["pending", "partial", "overdue"] } } },
        { $group: { _id: "$feeStatus", total: { $sum: "$remainingAmount" }, count: { $sum: 1 } } },
      ]),

      // Total collected — all-time successful payments
      Payment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      // Monthly collected (last 12 months)
      Payment.aggregate([
        { $match: { paymentStatus: "success", paidAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
            total: { $sum: "$amount" },
          },
        },
      ]),

      // Monthly fee plans generated (by Fee.createdAt)
      Fee.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            total: { $sum: "$finalFee" },
          },
        },
      ]),

      // ── Course-wise — group by RESOLVED TITLE, not raw ID ──────────────────
      // This collapses every fee with no course / an unmatched course
      // reference into a single "Unassigned" bucket instead of one bucket
      // per distinct (non-matching) value.
//       Fee.aggregate([
//         {
//           $lookup: {
//             from: "courses",
//             localField: "course",
//             foreignField: "_id",
//             as: "courseData",
//           },
//         },
//         { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
//         {
//           $group: {
//             _id: { $ifNull: ["$courseData.title", "Unassigned"] },
//             courseId: { $first: "$course" },
//             totalFees: { $sum: "$finalFee" },
//             totalCollected: { $sum: "$totalPaid" },
//             totalPending: { $sum: "$remainingAmount" },
//             students: { $sum: 1 },
//           },
//         },
//         { $sort: { totalCollected: -1 } },
//       ]),

 Fee.aggregate([
        {
          $lookup: {
            from: "courses",
            localField: "course",
            foreignField: "_id",
            as: "courseData",
          },
        },
        { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },

        // Fallback: pull the student's assigned course when Fee.course is empty
        {
          $lookup: {
            from: "studentassignments",
            localField: "student",
            foreignField: "student",
            as: "assignmentData",
          },
        },
        { $unwind: { path: "$assignmentData", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "courses",
            localField: "assignmentData.course",
            foreignField: "_id",
            as: "assignedCourseData",
          },
        },
        { $unwind: { path: "$assignedCourseData", preserveNullAndEmptyArrays: true } },

        {
          $addFields: {
            resolvedCourseTitle: {
              $ifNull: ["$courseData.title", { $ifNull: ["$assignedCourseData.title", "Unassigned"] }],
            },
            resolvedCourseId: {
              $ifNull: ["$course", "$assignmentData.course"],
            },
          },
        },

        {
          $group: {
            _id: "$resolvedCourseTitle",
            courseId: { $first: "$resolvedCourseId" },
            totalFees: { $sum: "$finalFee" },
            totalCollected: { $sum: "$totalPaid" },
            totalPending: { $sum: "$remainingAmount" },
            students: { $sum: 1 },
          },
        },
        { $sort: { totalCollected: -1 } },
      ]),

      // ── Counsellor-wise — same fix: group by resolved name ─────────────────
      Fee.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "counsellor",
            foreignField: "_id",
            as: "counsellorData",
          },
        },
        { $unwind: { path: "$counsellorData", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$counsellorData.fullName", "Unassigned"] },
            counsellorId: { $first: "$counsellor" },
            totalFees: { $sum: "$finalFee" },
            totalCollected: { $sum: "$totalPaid" },
            totalPending: { $sum: "$remainingAmount" },
            students: { $sum: 1 },
          },
        },
        { $sort: { totalCollected: -1 } },
      ]),

      // ── Real installments (EMI plans) — status computed live ───────────────
      FeeInstallment.aggregate([
        {
          $addFields: {
            computedStatus: {
              $cond: [
                { $gte: ["$paidAmount", "$amount"] },
                "paid",
                {
                  $cond: [
                    { $lt: ["$dueDate", "$$NOW"] },
                    "overdue",
                    { $cond: [{ $gt: ["$paidAmount", 0] }, "partial", "pending"] },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$computedStatus",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            paidAmount: { $sum: "$paidAmount" },
            remainingAmount: { $sum: "$remainingAmount" },
          },
        },
      ]),

      // ── Fee plans on "full" mode — these never get FeeInstallment docs.
      // Fetch them so we can synthesize one virtual installment per plan.
      Fee.find({ paymentMode: "full", totalFees: { $gt: 0 } })
        .select("finalFee totalPaid remainingAmount feeStatus")
        .lean(),

      // Recent payments (last 10)
      Payment.find({ paymentStatus: "success" })
        .sort({ paidAt: -1 })
        .limit(10)
        .populate("student", "fullName studentId")
        .populate("course", "title")
        .populate("recordedBy", "fullName"),
    ]);

    // ── Assemble overview ────────────────────────────────────────────────────
    const totalFeesGenerated = feeTotalsAgg[0]?.total || 0;
    const totalStudentsWithFee = feeTotalsAgg[0]?.count || 0;
    const totalCollected = collectedAgg[0]?.total || 0;

    const pendingBucket = statusBucketsAgg.find((p) => p._id === "pending");
    const partialBucket = statusBucketsAgg.find((p) => p._id === "partial");
    const overdueBucket = statusBucketsAgg.find((p) => p._id === "overdue");

    const totalPending = (pendingBucket?.total || 0) + (partialBucket?.total || 0);
    const totalOverdue = overdueBucket?.total || 0;
    const overdueStudentCount = overdueBucket?.count || 0;

    const collectionRate =
      totalFeesGenerated > 0
        ? Number(((totalCollected / totalFeesGenerated) * 100).toFixed(1))
        : 0;

    // ── Monthly trend merge ──────────────────────────────────────────────────
    const collectedMap = {};
    monthlyCollectedAgg.forEach(({ _id, total }) => {
      collectedMap[`${_id.year}-${_id.month}`] = total;
    });
    const generatedMap = {};
    monthlyGeneratedAgg.forEach(({ _id, total }) => {
      generatedMap[`${_id.year}-${_id.month}`] = total;
    });

    const monthlyTrend = months.map(({ year, month, label }) => {
      const key = `${year}-${month}`;
      return {
        month: label,
        collected: collectedMap[key] || 0,
        generated: generatedMap[key] || 0,
      };
    });

    // ── Course-wise ───────────────────────────────────────────────────────────
    const courseWise = courseWiseAgg.map((c) => ({
      courseId: c.courseId || null,
      course: c._id, // already the resolved title / "Unassigned"
      totalFees: c.totalFees,
      collected: c.totalCollected,
      pending: c.totalPending,
      students: c.students,
      collectionRate:
        c.totalFees > 0 ? Number(((c.totalCollected / c.totalFees) * 100).toFixed(1)) : 0,
    }));

    // ── Counsellor-wise ──────────────────────────────────────────────────────
    const counsellorWise = counsellorWiseAgg.map((c) => ({
      counsellorId: c.counsellorId || null,
      counsellor: c._id, // already the resolved name / "Unassigned"
      totalFees: c.totalFees,
      collected: c.totalCollected,
      pending: c.totalPending,
      students: c.students,
      collectionRate:
        c.totalFees > 0 ? Number(((c.totalCollected / c.totalFees) * 100).toFixed(1)) : 0,
    }));

    // ── Installment summary: real (EMI) + virtual (full-mode plans) ─────────
    const installmentStatuses = ["paid", "partial", "pending", "overdue"];
    const installmentSummary = installmentStatuses.reduce((acc, status) => {
      acc[status] = { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0 };
      return acc;
    }, {});

    // Fold in real EMI installments
    realInstallmentAgg.forEach((bucket) => {
      if (!installmentSummary[bucket._id]) return;
      installmentSummary[bucket._id].count += bucket.count;
      installmentSummary[bucket._id].totalAmount += bucket.totalAmount;
      installmentSummary[bucket._id].paidAmount += bucket.paidAmount;
      installmentSummary[bucket._id].remainingAmount += bucket.remainingAmount;
    });

    // Fold in one virtual installment per "full" mode fee plan.
    // Map Fee.feeStatus → installment status bucket:
    //   paid → paid, overdue → overdue, partial → partial,
    //   pending → pending (no-plan is skipped, already filtered by totalFees > 0)
    fullModeFeesForVirtualInstallments.forEach((fee) => {
      const bucketKey = installmentStatuses.includes(fee.feeStatus) ? fee.feeStatus : "pending";
      installmentSummary[bucketKey].count += 1;
      installmentSummary[bucketKey].totalAmount += fee.finalFee || 0;
      installmentSummary[bucketKey].paidAmount += fee.totalPaid || 0;
      installmentSummary[bucketKey].remainingAmount += fee.remainingAmount || 0;
    });

    return send(res, 200, true, "Fee collection reports fetched", {
      overview: {
        totalFeesGenerated,
        totalCollected,
        totalPending,
        totalOverdue,
        collectionRate,
        totalStudentsWithFee,
        overdueStudentCount,
      },
      monthlyTrend,
      courseWise,
      counsellorWise,
      installmentSummary,
      recentPayments,
    });
  } catch (error) {
    console.error("getFeeCollectionReports error:", error);
    return send(res, 500, false, "Server Error");
  }
};

module.exports = { getFeeCollectionReports };
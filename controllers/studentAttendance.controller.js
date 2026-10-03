const Attendance = require("../models/Attendance");

// No per-course "required %" field exists yet — using a fixed institute-wide
// minimum until that becomes configurable per course/batch.
const REQUIRED_ATTENDANCE_PERCENT = 75;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const send = (res, status, success, message, data) =>
  res.status(status).json({ success, message, data });

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

// GET /api/student/attendance?month=8&year=2026
// month is 1-indexed and optional — defaults to the current month.
const getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const now = new Date();
    const queryMonth = req.query.month ? parseInt(req.query.month, 10) : now.getUTCMonth() + 1;
    const queryYear = req.query.year ? parseInt(req.query.year, 10) : now.getUTCFullYear();

    // ── All-time summary ──
    const allRecords = await Attendance.find({ student: studentId }).select("status date");

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    allRecords.forEach((r) => {
      if (r.status === "present") presentDays += 1;
      else if (r.status === "absent") absentDays += 1;
      else if (r.status === "leave") leaveDays += 1;
    });
    const totalMarked = presentDays + absentDays + leaveDays;
    const currentPercentage = pct(presentDays, totalMarked);

    // ── Monthly trend: last 6 calendar months, including current ──
    const monthBuckets = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthBuckets.push({ year: d.getUTCFullYear(), month: d.getUTCMonth(), label: MONTH_LABELS[d.getUTCMonth()] });
    }

    const monthlyTrend = monthBuckets.map(({ year, month, label }) => {
      const inMonth = allRecords.filter((r) => {
        const rd = new Date(r.date);
        return rd.getUTCFullYear() === year && rd.getUTCMonth() === month;
      });
      const present = inMonth.filter((r) => r.status === "present").length;
      return { month: label, attendance: pct(present, inMonth.length) };
    });

    // ── Requested-month calendar ──
    const calendarStart = new Date(Date.UTC(queryYear, queryMonth - 1, 1));
    const calendarEnd = new Date(Date.UTC(queryYear, queryMonth, 1));
    const daysInMonth = new Date(Date.UTC(queryYear, queryMonth, 0)).getUTCDate();

    const monthRecords = await Attendance.find({
      student: studentId,
      date: { $gte: calendarStart, $lt: calendarEnd },
    }).select("date status");

    const statusByDay = {};
    monthRecords.forEach((r) => {
      statusByDay[new Date(r.date).getUTCDate()] = r.status;
    });

    // status is null for days never marked — the frontend should render
    // those neutrally instead of guessing "present".
    const calendar = Array.from({ length: daysInMonth }, (_, i) => ({
      date: i + 1,
      status: statusByDay[i + 1] ?? null,
    }));

    return send(res, 200, true, "Attendance fetched", {
      summary: {
        currentPercentage,
        requiredPercentage: REQUIRED_ATTENDANCE_PERCENT,
        presentDays,
        absentDays,
        leaveDays,
      },
      monthlyTrend,
      calendar,
      calendarMonthLabel: MONTH_LABELS[queryMonth - 1],
      calendarYear: queryYear,
      legend: [
        { label: "Present", status: "present" },
        { label: "Absent", status: "absent" },
        { label: "On Leave", status: "leave" },
      ],
    });
  } catch (error) {
    console.error("getMyAttendance error:", error);
    return send(res, 500, false, "Server error", null);
  }
};

module.exports = { getMyAttendance };
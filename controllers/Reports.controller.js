const Inquiry = require("../models/Inquiry");
const Branch = require("../models/Branch");

// ── GET /api/reports/global?days=30 ────────────────────────────────────────
// Image 1 (Global Analytics Dashboard) ka pura data ek hi response mein.
const getGlobalAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const [branches, leadsInRange, allLeads] = await Promise.all([
      Branch.find(),
      Inquiry.find({ createdAt: { $gte: since } }),
      Inquiry.find(),
    ]);

    const isOverdue = (l) =>
      l.nextFollowUpDate &&
      new Date(l.nextFollowUpDate) < new Date() &&
      l.leadStatus !== "converted";

    // ── Top KPI cards ────────────────────────────────────────────────────
    const convertedInRange = leadsInRange.filter((l) => l.leadStatus === "converted");
    const totalAdmissions = convertedInRange.length;
    const totalRevenue = convertedInRange.reduce(
      (sum, l) => sum + (l.fees?.max || 0),
      0
    );
    const overallConversion = leadsInRange.length
      ? Number(((totalAdmissions / leadsInRange.length) * 100).toFixed(1))
      : 0;

    const missedCount = leadsInRange.filter(isOverdue).length;
    const missedFollowUpRate = leadsInRange.length
      ? Number(((missedCount / leadsInRange.length) * 100).toFixed(1))
      : 0;

    // ── Revenue by Branch (bar chart) ────────────────────────────────────
    const revenueByBranch = branches.map((b) => {
      const revenue = convertedInRange
        .filter((l) => String(l.branch) === String(b._id))
        .reduce((sum, l) => sum + (l.fees?.max || 0), 0);
      return { branch: b.code, name: b.name, revenue };
    });

    // ── Conversion Funnel ────────────────────────────────────────────────
    const leadsGenerated = leadsInRange.length;
    const demosConducted = leadsInRange.filter((l) => l.demoCompleted).length;
    const enrollments = totalAdmissions;
    const conversionFunnel = {
      leadsGenerated,
      demosConducted,
      enrollments,
      demoDropoffPct: leadsGenerated
        ? Math.round(((leadsGenerated - demosConducted) / leadsGenerated) * 100)
        : 0,
      enrollCRPct: demosConducted
        ? Math.round((enrollments / demosConducted) * 100)
        : 0,
    };

    // ── Lead Source Performance ──────────────────────────────────────────
    const sources = ["Website", "WhatsApp", "Instagram", "Facebook", "Referral", "Other"];
    const leadSourcePerformance = sources
      .map((s) => {
        const count = leadsInRange.filter((l) => l.source === s).length;
        return {
          source: s,
          count,
          percent: leadsGenerated ? Math.round((count / leadsGenerated) * 100) : 0,
        };
      })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);

    // ── Top Counsellors ──────────────────────────────────────────────────
    const counsellorMap = {};
    leadsInRange.forEach((l) => {
      if (!l.assignedTo) return;
      if (!counsellorMap[l.assignedTo]) {
        counsellorMap[l.assignedTo] = {
          name: l.assignedTo,
          leads: 0,
          admissions: 0,
          revenue: 0,
        };
      }
      counsellorMap[l.assignedTo].leads += 1;
      if (l.leadStatus === "converted") {
        counsellorMap[l.assignedTo].admissions += 1;
        counsellorMap[l.assignedTo].revenue += l.fees?.max || 0;
      }
    });
    const topCounsellors = Object.values(counsellorMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ── Branch Productivity Audit ────────────────────────────────────────
    const branchAudit = branches.map((b) => {
      const branchLeads = allLeads.filter((l) => String(l.branch) === String(b._id));
      const activeLeads = branchLeads.filter(
        (l) => !["converted", "lost"].includes(l.leadStatus)
      ).length;
      const missedFollowUps = branchLeads.filter(isOverdue).length;
      const healthIndex = activeLeads
        ? Math.max(0, Math.round(100 - (missedFollowUps / activeLeads) * 100))
        : 100;
      const health =
        healthIndex >= 80 ? "optimal" : healthIndex >= 50 ? "warning" : "critical";

      return {
        branchId: b._id,
        branch: b.name,
        counsellorCount: b.counsellorCount || 0,
        activeLeads,
        missedFollowUps,
        healthIndex,
        health,
      };
    });

    // ── Priority Alerts (banner at top) ──────────────────────────────────
    const criticalBranches = branchAudit.filter((b) => b.health === "critical");
    const priorityAlerts = criticalBranches.length
      ? [
          {
            title: "High Missed Follow-ups",
            message: `Critical follow-up delays detected in ${criticalBranches
              .map((b) => b.branch)
              .join(", ")}. Immediate intervention required.`,
          },
        ]
      : [];

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalAdmissions,
        overallConversion,
        missedFollowUpRate,
        revenueByBranch,
        conversionFunnel,
        leadSourcePerformance,
        topCounsellors,
        branchAudit,
        priorityAlerts,
      },
    });
  } catch (error) {
    console.error("getGlobalAnalytics error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getGlobalAnalytics };
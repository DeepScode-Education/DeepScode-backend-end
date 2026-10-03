// modules/live-class/jobs/autoEndStaleClasses.js
const { LiveClass } = require("../models");
const { attendanceService } = require("../services");
const { closeRoom } = require("../services/livekit.service");
const { emitMeetingEnded } = require("../sockets/liveClass.socket");
const { logInfo } = require("../../../utils/logger");

const AUTO_END_CHECK_INTERVAL_MS = 60 * 1000;

const startAutoEndJob = (io) => {
  setInterval(async () => {
    try {
      const liveClasses = await LiveClass.find({ status: "live" });

      for (const liveClass of liveClasses) {
        const timeoutMinutes = Number(liveClass.autoEndTimeoutMinutes ?? 10);
        const lastHeartbeat = liveClass.lastHostHeartbeat || liveClass.startedAt;

        if (!lastHeartbeat) continue;

        const timeoutMs = timeoutMinutes * 60 * 1000;
        const elapsedMs = Date.now() - lastHeartbeat.getTime();

        if (elapsedMs <= timeoutMs) continue;

        const endedClass = await LiveClass.findOneAndUpdate(
          { _id: liveClass._id, status: "live" },
          { $set: { status: "ended", endedAt: new Date() } },
          { new: true, runValidators: true },
        );

        if (!endedClass) continue;

        // Close the LiveKit room too, otherwise students stay connected to a
        // class the database already considers ended.
        await closeRoom(endedClass.livekitRoomName);

        try {
          await attendanceService.finalizeAttendanceForClass(endedClass._id);
        } catch (err) {
          console.error("[auto-end] Attendance finalization failed after class ended:", err.message);
        }
        emitMeetingEnded(io, endedClass._id);

        logInfo(`[auto-end] Ended stale live class ${endedClass._id}`);
      }
    } catch (err) {
      console.error("[auto-end job] failed:", err.message);
    }
  }, AUTO_END_CHECK_INTERVAL_MS);
};

module.exports = { startAutoEndJob };
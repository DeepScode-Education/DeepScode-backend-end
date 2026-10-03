// // modules/live-class/sockets/liveClass.socket.js
// const jwt = require("jsonwebtoken");
// const { LiveClass } = require("../models");
// const { isStudentInBatch } = require("../services/liveClass.service");

// const emitMeetingEnded = (io, liveClassId) => {
//   if (!io) return;
//   const roomId = String(liveClassId);
//   io.of("/live").to(roomId).emit("meeting-ended", { liveClassId: roomId });
// };

// const registerLiveClassSockets = (io) => {
//   const nsp = io.of("/live");

//   nsp.use((socket, next) => {
//     try {
//       const token = socket.handshake.auth?.token;
//       if (!token) return next(new Error("No token provided"));
//       socket.user = jwt.verify(token, process.env.JWT_SECRET);
//       next();
//     } catch {
//       next(new Error("Invalid or expired token"));
//     }
//   });

//   nsp.on("connection", (socket) => {
//     socket.on("join-room", async ({ liveClassId }) => {
//       try {
//         const liveClass = await LiveClass.findById(liveClassId);
//         if (!liveClass) return socket.emit("error", { message: "Live class not found" });

//         const isHost = String(liveClass.mentor) === String(socket.user.id);
//         const isEnrolled =
//           !isHost &&
//           (await isStudentInBatch(socket.user.id, liveClass.course, liveClass.batch.days, liveClass.batch.time));

//         if (!isHost && !isEnrolled) {
//           return socket.emit("error", { message: "Not authorized to join this room" });
//         }

//         socket.join(liveClassId);
//         if (!isHost) nsp.to(liveClassId).emit("student-joined", { userId: socket.user.id });
//       } catch (err) {
//         socket.emit("error", { message: "Failed to join room" });
//       }
//     });

//     socket.on("leave-room", ({ liveClassId }) => {
//       socket.leave(liveClassId);
//       if (socket.user.role !== "mentor") {
//         nsp.to(liveClassId).emit("student-left", { userId: socket.user.id });
//       }
//     });

//     socket.on("raise-hand", ({ liveClassId, userName, raised }) => {
//       if (!liveClassId || typeof userName !== "string" || !userName.trim()) return;

//       if (!socket.rooms.has(liveClassId)) {
//         return socket.emit("error", { message: "Join the room before raising your hand" });
//       }

//       nsp.to(liveClassId).emit("hand-raised", {
//         liveClassId,
//         userName: userName.trim(),
//         raised: !!raised,
//       });
//     });
//   });

//   return nsp;
// };

// module.exports = { registerLiveClassSockets, emitMeetingEnded };




const jwt = require("jsonwebtoken");
const { LiveClass } = require("../models");
const { isStudentInBatch } = require("../services/liveClass.service");
const User = require("../../../models/User");

const emitMeetingEnded = (io, liveClassId) => {
  if (!io) return;
  const roomId = String(liveClassId);
  io.of("/live").to(roomId).emit("meeting-ended", { liveClassId: roomId });
};

const registerLiveClassSockets = (io) => {
  const nsp = io.of("/live");

  nsp.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  nsp.on("connection", (socket) => {
    socket.on("join-room", async ({ liveClassId }) => {
      try {
        const liveClass = await LiveClass.findById(liveClassId);
        if (!liveClass) return socket.emit("error", { message: "Live class not found" });

        const isHost = String(liveClass.mentor) === String(socket.user.id);
        const isEnrolled =
          !isHost &&
          (await isStudentInBatch(socket.user.id, liveClass.course, liveClass.batch.days, liveClass.batch.time));

        if (!isHost && !isEnrolled) {
          return socket.emit("error", { message: "Not authorized to join this room" });
        }

        socket.join(liveClassId);
        if (!isHost) nsp.to(liveClassId).emit("student-joined", { userId: socket.user.id });
      } catch (err) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave-room", ({ liveClassId }) => {
      socket.leave(liveClassId);
      if (socket.user.role !== "mentor") {
        nsp.to(liveClassId).emit("student-left", { userId: socket.user.id });
      }
    });

    socket.on("raise-hand", ({ liveClassId, userName, raised }) => {
      if (!liveClassId || typeof userName !== "string" || !userName.trim()) return;

      if (!socket.rooms.has(liveClassId)) {
        return socket.emit("error", { message: "Join the room before raising your hand" });
      }

      nsp.to(liveClassId).emit("hand-raised", {
        liveClassId,
        userName: userName.trim(),
        raised: !!raised,
      });
    });

    // Shared classroom chat: broadcast to mentor + every student, including sender.
    socket.on("chat-message", async ({ liveClassId, message }) => {
      try {
        if (!liveClassId || typeof message !== "string") return;

        if (!socket.rooms.has(String(liveClassId))) {
          return socket.emit("error", {
            message: "Join the room before sending chat messages",
          });
        }

        const cleanMessage = message.trim().slice(0, 2000);
        if (!cleanMessage) return;

        const sender = await User.findById(socket.user.id)
          .select("fullName name username")
          .lean();

        const userName =
          sender?.fullName?.trim() ||
          sender?.name?.trim() ||
          sender?.username?.trim() ||
          `Participant-${socket.user.id}`;

        nsp.to(String(liveClassId)).emit("chat-message", {
          liveClassId: String(liveClassId),
          senderId: String(socket.user.id),
          userName,
          message: cleanMessage,
          sentAt: Date.now(),
        });
      } catch (err) {
        console.error("[live-chat] failed:", err.message);
        socket.emit("error", { message: "Could not send chat message" });
      }
    });
  });

  return nsp;
};

module.exports = { registerLiveClassSockets, emitMeetingEnded };

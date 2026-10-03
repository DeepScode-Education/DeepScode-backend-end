// utils/processHandlers.js
//
// Catches the two classes of error that NEVER reach Express's error
// middleware: unhandled promise rejections (e.g. a stray `.then()` with no
// `.catch()`, or a fire-and-forget async call) and uncaught synchronous
// exceptions. Without this, these currently either crash the process with
// no useful log, or (for unhandled rejections on older Node versions) get
// silently swallowed.
//
// Call registerProcessErrorHandlers() once, near the top of index.js,
// before anything else starts.

const { logError } = require("./logger");

const registerProcessErrorHandlers = () => {
  process.on("unhandledRejection", (reason) => {
    console.error("\x1b[31m✖ UNHANDLED PROMISE REJECTION — this should be fixed, but the process will keep running.\x1b[0m");
    logError(reason instanceof Error ? reason : new Error(String(reason)));
  });

  process.on("uncaughtException", (err) => {
    console.error("\x1b[31m✖ UNCAUGHT EXCEPTION — logging and shutting down gracefully...\x1b[0m");
    logError(err);
    // Give the log a moment to flush to disk/terminal before exiting.
    // In production, a process manager (PM2 / Render / systemd) should restart the process.
    setTimeout(() => process.exit(1), 300);
  });
};

module.exports = registerProcessErrorHandlers;
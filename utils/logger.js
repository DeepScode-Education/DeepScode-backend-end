// utils/logger.js
//
// Dependency-free structured logging. Every error that reaches the
// centralized handler (or process.on("uncaughtException"/"unhandledRejection"))
// is printed to the terminal with full context AND appended to
// slate-Server/logs/error.log, so nothing is lost once the terminal scrolls
// away.
//
// This intentionally does NOT use a logging library (winston/pino) to avoid
// adding a new dependency — swap it out later if you want log rotation,
// remote shipping, etc. The function signatures below are the only thing
// the rest of the app depends on, so that swap is a one-file change.

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "logs");
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {
  // If the filesystem is read-only (some hosting platforms), just skip file logging.
}

const COLOR = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
};

const timestamp = () => new Date().toISOString();

const SENSITIVE_KEYS = ["password", "newPassword", "otp", "token", "secret", "apiKey", "authorization"];

const sanitize = (obj = {}) => {
  if (!obj || typeof obj !== "object") return obj;
  const clean = { ...obj };
  SENSITIVE_KEYS.forEach((k) => {
    if (k in clean) clean[k] = "[REDACTED]";
  });
  return clean;
};

const appendToFile = (filename, line) => {
  try {
    fs.appendFileSync(path.join(LOG_DIR, filename), line + "\n");
  } catch (_) {
    // Never let logging itself crash the request
  }
};

/**
 * logError(err, req?)
 * Prints full error context to the terminal and appends it to logs/error.log.
 * Safe to call with just an Error — req is optional (e.g. for background jobs
 * or process-level crash handlers where there is no request).
 */
const logError = (err, req = null) => {
  const time = timestamp();
  const route = req ? `${req.method} ${req.originalUrl}` : "N/A (no request context)";
  const user = req?.user ? `${req.user.role || "unknown-role"}#${req.user.id}` : "anonymous";
  const params = req?.params && Object.keys(req.params).length ? JSON.stringify(req.params) : "{}";
  const query = req?.query && Object.keys(req.query).length ? JSON.stringify(req.query) : "{}";
  const body = req?.body ? JSON.stringify(sanitize(req.body)) : "{}";

  console.error(`\n${COLOR.red}✖ ERROR${COLOR.reset} ${COLOR.gray}[${time}]${COLOR.reset}`);
  console.error(`${COLOR.cyan}Route:${COLOR.reset}   ${route}`);
  console.error(`${COLOR.cyan}User:${COLOR.reset}    ${user}`);
  if (params !== "{}") console.error(`${COLOR.cyan}Params:${COLOR.reset}  ${params}`);
  if (query !== "{}")  console.error(`${COLOR.cyan}Query:${COLOR.reset}   ${query}`);
  if (body !== "{}")   console.error(`${COLOR.cyan}Body:${COLOR.reset}    ${body}`);
  console.error(`${COLOR.cyan}Message:${COLOR.reset} ${err.message}`);
  if (err.errorCode) console.error(`${COLOR.cyan}Code:${COLOR.reset}    ${err.errorCode}`);
  if (err.details)   console.error(`${COLOR.cyan}Details:${COLOR.reset} ${JSON.stringify(err.details)}`);
  console.error(`${COLOR.yellow}Stack:${COLOR.reset}\n${err.stack || "(no stack trace available)"}\n`);

  const fileLine = [
    `[${time}]`,
    `route=${route}`,
    `user=${user}`,
    `code=${err.errorCode || "N/A"}`,
    `message="${err.message}"`,
    params !== "{}" ? `params=${params}` : "",
    query !== "{}" ? `query=${query}` : "",
    body !== "{}" ? `body=${body}` : "",
    `\n${err.stack || ""}`,
    "\n---",
  ]
    .filter(Boolean)
    .join(" ");

  appendToFile("error.log", fileLine);
};

/** logInfo(message) — lightweight info-level log for startup / lifecycle events */
const logInfo = (message) => {
  console.log(`${COLOR.green}ℹ INFO${COLOR.reset} ${COLOR.gray}[${timestamp()}]${COLOR.reset} ${message}`);
};

/** logWarn(message) — for recoverable/soft-failure situations worth flagging */
const logWarn = (message) => {
  console.warn(`${COLOR.yellow}⚠ WARN${COLOR.reset} ${COLOR.gray}[${timestamp()}]${COLOR.reset} ${message}`);
};

module.exports = { logError, logInfo, logWarn };
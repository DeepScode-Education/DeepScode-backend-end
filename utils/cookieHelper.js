// utils/cookieHelper.js
//
// Lightweight visitor-cookie helpers. We deliberately do NOT add the
// `cookie-parser` dependency — it isn't used anywhere else in this
// codebase, and we only need to read/write one simple cookie here.
// res.cookie() itself is a native Express feature (no extra package).

const crypto = require("crypto");

const VISITOR_COOKIE_NAME = "svid"; // "slate visitor id"
const VISITOR_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Parses the raw `Cookie` request header into a plain key/value object.
 */
const parseCookies = (cookieHeader = "") => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch (_) {
        cookies[key] = value;
      }
    }
  });

  return cookies;
};

/**
 * Returns the existing visitorId from the request's cookies, or generates
 * a fresh one. Does NOT set the cookie itself — the caller decides
 * whether/when to actually write it via setVisitorCookie().
 */
const getOrCreateVisitorId = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[VISITOR_COOKIE_NAME]) {
    return { visitorId: cookies[VISITOR_COOKIE_NAME], isNew: false };
  }
  return { visitorId: crypto.randomUUID(), isNew: true };
};

/**
 * Reads the visitorId from a request WITHOUT generating a new one — used
 * by endpoints (like the geolocation endpoint) that should only ever act
 * on a visitor who already has a tracked session.
 */
const getVisitorIdFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[VISITOR_COOKIE_NAME] || null;
};

const setVisitorCookie = (res, visitorId) => {
  try {
    const isProd = process.env.NODE_ENV === "production";
    res.cookie(VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: true,
      // "none" is required for cross-site cookie delivery in production
      // (frontend/backend on different subdomains); browsers require
      // `secure: true` whenever sameSite is "none".
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      maxAge: VISITOR_COOKIE_MAX_AGE_MS,
    });
  } catch (err) {
    // Never let cookie assignment crash a page/API request.
    console.error("[visitor] failed to set visitor cookie:", err.message);
  }
};

module.exports = {
  VISITOR_COOKIE_NAME,
  parseCookies,
  getOrCreateVisitorId,
  getVisitorIdFromRequest,
  setVisitorCookie,
};
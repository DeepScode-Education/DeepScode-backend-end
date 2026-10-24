const SSR_INTERNAL_SECRET = process.env.SSR_INTERNAL_SECRET || "8cb6631265e7f2d78a67b9bbe99599e59ec74200dbfa639dd68266df2f8ee1da";


const PRODUCTION_ORIGINS = [
  "https://slate-academy.com",
  "https://www.slate-academy.com",
  "https://cyber-security.slate-academy.com",
  "https://data-analytics.slate-academy.com",
];
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGINS;
  const devOrigins = (
    process.env.DEV_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://localhost:5174,http://localhost:8080,http://localhost:8081,http://localhost:5050,http://localhost:5175,http://192.168.29.230:8080,"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...PRODUCTION_ORIGINS, ...devOrigins];
};

// Matches the User-Agent strings sent by default (i.e. un-spoofed) by the
// most common scripting/testing tools. A real browser never sends these.
const BLOCKED_UA_PATTERNS = [
  /curl/i,
  /wget/i,
  /postman/i,
  /insomnia/i,
  /python-requests/i,
  /python-urllib/i,
  /axios\/\d/i,
  /node-fetch/i,
  /go-http-client/i,
  /java\/\d/i,
  /okhttp/i,
  /libwww-perl/i,
  /httpclient/i,
  /scrapy/i,
  /^$/, // empty UA
];

const isBlockedUserAgent = (ua) => {
  if (!ua) return true;
  return BLOCKED_UA_PATTERNS.some((re) => re.test(ua));
};

const originFromUrl = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

// ── Lightweight in-memory sliding-window rate limiter ─────────────────────────
// No new dependency required. Per-process only — fine for a single Render
// instance; if you scale to multiple instances behind a load balancer,
// swap this for a Redis-backed limiter (you already have Redis configured
// in config/redis.js, so that's a small follow-up if needed).
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // per IP per window, per protected route group
const rateLimitBuckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitBuckets.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitBuckets.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

const isRateLimited = (ip) => {
  const now = Date.now();
  const entry = rateLimitBuckets.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
};

const getClientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.socket?.remoteAddress ||
  "unknown";

const denyAccess = (res) =>
  res.status(403).json({ success: false, message: "Access denied" });

/**
 * Mount ONLY on route groups that are intentionally public. Never mount on
 * routes that already require JWT auth — those are protected by auth
 * middleware and don't need (or want) anonymous browser traffic assumed.
 */
const publicApiProtection = (req, res, next) => {
  if (req.method === "OPTIONS") return next(); // let cors() handle preflight

  if (SSR_INTERNAL_SECRET && req.headers["x-ssr-secret"] === SSR_INTERNAL_SECRET) {
    return next();
  }
  const allowed = getAllowedOrigins();
  const origin = req.headers.origin;
  const referer = req.headers.referer || req.headers.referrer;
  const userAgent = req.headers["user-agent"];

  // 1. Origin must be present and in the allowlist.
  if (!origin || !allowed.includes(origin)) return denyAccess(res);

 
  if (referer) {
    const refererOrigin = originFromUrl(referer);
    if (!refererOrigin || !allowed.includes(refererOrigin)) return denyAccess(res);
  }

  // 3. Block requests whose User-Agent matches known non-browser tools.
  if (isBlockedUserAgent(userAgent)) return denyAccess(res);

  // 4. Rate limit per IP to blunt scripted abuse that does spoof headers.
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return denyAccess(res);

  return next();
};

module.exports = publicApiProtection;
module.exports.getAllowedOrigins = getAllowedOrigins;
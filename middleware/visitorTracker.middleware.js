const jwt = require("jsonwebtoken");
const IpLog = require("../models/IpLog");
const User = require("../models/User");
const { encrypt } = require("../utils/encryption");
const { getOrCreateVisitorId, setVisitorCookie } = require("../utils/cookieHelper");

const ALLOWED_HOSTS = [
  "deepScode.com",
  "www.deepScode.com",
];

const IGNORED_PREFIXES = [
  "/api",
  "/assets",
  "/images",
  "/uploads",
  "/css",
  "/js",
  "/fonts",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

const getDeviceInfo = (userAgent = "") => {
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "Mobile";
  return "Desktop";
};

const getBrowser = (userAgent = "") => {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/opr|opera/i.test(userAgent)) return "Opera";
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent))
    return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent))
    return "Safari";

  return "Unknown";
};

const getOS = (userAgent = "") => {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/mac/i.test(userAgent)) return "MacOS";
  if (/linux/i.test(userAgent)) return "Linux";

  return "Unknown";
};

/**
 * Verifies the Authorization Bearer token (if present) EXACTLY the way
 * optionalAuth does elsewhere in this codebase, and returns the
 * authenticated user's id — or null.
 *
 * IMPORTANT: this middleware runs globally, BEFORE the per-route `auth` /
 * `optionalAuth` middlewares, so req.user is never already set here. We
 * never trust any user-identity field the frontend might send in the
 * request body/query — the only source of truth for "who is this
 * visitor" is a valid, server-verified JWT.
 */
const resolveAuthenticatedUserId = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.id || null;
    }
  } catch (_) {
    // invalid/expired token → treat as anonymous, same as optionalAuth
  }
  return null;
};

const visitorTracker = async (req, res, next) => {
  try {
    // ============================
    // Track only production domain
    // ============================
    const host = req.get("host") || "";

    if (!ALLOWED_HOSTS.some((domain) => host.includes(domain))) {
      return next();
    }

    // ============================
    // Ignore API & Static Files
    // ============================
    if (
      IGNORED_PREFIXES.some((prefix) =>
        req.originalUrl.startsWith(prefix)
      )
    ) {
      return next();
    }

    // ============================
    // Visitor identity (cookie)
    // ============================
    const { visitorId, isNew } = getOrCreateVisitorId(req);
    if (isNew) {
      setVisitorCookie(res, visitorId);
    }

    // ============================
    // Get Real Client IP
    // ============================
    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress ||
      "";

    if (ip.startsWith("::ffff:")) {
      ip = ip.replace("::ffff:", "");
    }

    const userAgent = req.headers["user-agent"] || "";

    const encryptedIP = encrypt(ip);

    // ============================
    // Prevent Duplicate (30 min)
    // ============================
    // Switched from (ip, page) to (visitorId, page): visitors sharing an
    // IP (office/college wifi, NAT) are now tracked as distinct people
    // instead of being collapsed into one shared record.
    const lastVisit = await IpLog.findOne({
      visitorId,
      page: req.originalUrl,
      visitedAt: {
        $gte: new Date(Date.now() - 30 * 60 * 1000),
      },
    });

    if (lastVisit) {
      return next();
    }

    // ============================
    // Securely resolve logged-in user
    // ============================
    // Looked up fresh from the User collection every time — never trusted
    // from anything the client claims about itself.
    let userDoc = null;
    const authenticatedUserId = resolveAuthenticatedUserId(req);
    if (authenticatedUserId) {
      userDoc = await User.findById(authenticatedUserId)
        .select("fullName email")
        .lean();
    }

    // ============================
    // Save Visitor
    // ============================
    await IpLog.create({
      visitorId,
      ip: encryptedIP,
      page: req.originalUrl,
      userAgent,
      browser: getBrowser(userAgent),
      device: getDeviceInfo(userAgent),
      os: getOS(userAgent),
      referrer: req.headers.referer || null,
      user: userDoc ? userDoc._id : null,
      userEmail: userDoc ? userDoc.email : null,
      userName: userDoc ? userDoc.fullName : null,
    });

    // ============================
    // Live Terminal Log
    // ============================
    console.log(`
====================================================
🟢 NEW WEBSITE VISITOR
====================================================

Time      : ${new Date().toLocaleString()}

Visitor   : ${visitorId}${userDoc ? ` (${userDoc.fullName} <${userDoc.email}>)` : " (anonymous)"}

IP        : ${ip}

Page      : ${req.originalUrl}

Browser   : ${getBrowser(userAgent)}

OS        : ${getOS(userAgent)}

Device    : ${getDeviceInfo(userAgent)}

Referrer  : ${req.headers.referer || "Direct"}

====================================================
`);

  } catch (error) {
    console.error("Visitor Tracker Error:", error.message);
  }

  next();
};

module.exports = visitorTracker;
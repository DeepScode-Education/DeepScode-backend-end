

// modules/live-class/utils/generateZoomSignature.js
const crypto = require("crypto");
const { ZoomConfigError } = require("../../../utils/errors/errorTypes");

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

const generateZoomSignature = ({ providerMeetingId, role }) => {
  if (!process.env.ZOOM_SDK_KEY || !process.env.ZOOM_SDK_SECRET) {
    throw new ZoomConfigError(
      "Zoom Meeting SDK is not configured on the server (ZOOM_SDK_KEY / ZOOM_SDK_SECRET missing in .env). " +
      "Get these from your Meeting SDK app on marketplace.zoom.us.",
      { missing: ["ZOOM_SDK_KEY", "ZOOM_SDK_SECRET"].filter((k) => !process.env[k]) }
    );
  }
  // ← NEW: fail with a clear message instead of a confusing crypto TypeError
  if (!process.env.ZOOM_SDK_KEY || !process.env.ZOOM_SDK_SECRET) {
    const err = new Error(
      "Zoom Meeting SDK is not configured on the server (ZOOM_SDK_KEY / ZOOM_SDK_SECRET missing in .env). " +
      "Get these from your Meeting SDK app on marketplace.zoom.us."
    );
    err.statusCode = 500;
    err.errorCode = "ZOOM_SDK_NOT_CONFIGURED";
    throw err;
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    appKey: process.env.ZOOM_SDK_KEY,
    sdkKey: process.env.ZOOM_SDK_KEY,
    mn: providerMeetingId,
    role,
    iat,
    exp,
    tokenExp: exp,
  };

  const unsigned = `${b64url(header)}.${b64url(payload)}`;
  const signature = crypto
    .createHmac("sha256", process.env.ZOOM_SDK_SECRET)
    .update(unsigned)
    .digest("base64url");

  return `${unsigned}.${signature}`;
};

module.exports = generateZoomSignature;
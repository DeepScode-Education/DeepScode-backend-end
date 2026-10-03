// utils/generateVideoSdkJwt.js
const jwt = require("jsonwebtoken");

const VIDEO_SDK_KEY    = process.env.ZOOM_SDK_KEY;
const VIDEO_SDK_SECRET = process.env.ZOOM_SDK_SECRET;

/**
 * @param {object} params
 * @param {string} params.sessionName    - unique string per class (use LiveClass._id)
 * @param {0|1}   params.roleType       - 1 = host (mentor), 0 = attendee (student)
 * @param {string} [params.sessionKey]  - optional passcode
 * @param {string} [params.userIdentity]- user._id for identification on client
 * @param {number} [params.expirationSeconds] - default 2 hours
 */
const generateVideoSdkJwt = ({
  sessionName,
  roleType,
  sessionKey = "",
  userIdentity = "",
  expirationSeconds = 60 * 60 * 2,
}) => {
  if (!VIDEO_SDK_KEY || !VIDEO_SDK_SECRET) {
    const err = new Error(
      "Zoom Video SDK credentials are not configured " +
      "(ZOOM_VIDEO_SDK_KEY / ZOOM_VIDEO_SDK_SECRET missing in .env). " +
      "Create a Video SDK app on marketplace.zoom.us."
    );
    err.statusCode = 500;
    err.errorCode  = "ZOOM_VIDEO_SDK_NOT_CONFIGURED";
    throw err;
  }

  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + expirationSeconds;

  const payload = {
    app_key:       VIDEO_SDK_KEY,
    tpc:           sessionName,   // "topic" = session name
    role_type:     roleType,
    session_key:   sessionKey,
    user_identity: userIdentity,
    version:       1,
    iat,
    exp,
  };

  return jwt.sign(payload, VIDEO_SDK_SECRET, { algorithm: "HS256" });
};

module.exports = generateVideoSdkJwt;
// modules/live-class/services/zoom.provider.js
const axios = require("axios");
const ILiveProvider = require("./liveProvider.interface");
const generateZoomSignature = require("../utils/generateZoomSignature");
const { ZoomConfigError, ZoomAPIError } = require("../../../utils/errors/errorTypes");

let cachedToken = null;
let cachedTokenExpiry = 0;

// ── Env validation — never logs the actual secret values ──────────────────────
const validateZoomOAuthEnv = () => {
  const missing = [];
  if (!process.env.ZOOM_CLIENT_ID) missing.push("ZOOM_CLIENT_ID");
  if (!process.env.ZOOM_CLIENT_SECRET) missing.push("ZOOM_CLIENT_SECRET");
  if (!process.env.ZOOM_ACCOUNT_ID) missing.push("ZOOM_ACCOUNT_ID");
  if (missing.length) {
    throw new ZoomConfigError(
      `Zoom Server-to-Server OAuth is not configured: missing ${missing.join(", ")}.`,
      { missing }
    );
  }
};

const getZoomAccessToken = async () => {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) return cachedToken;

  validateZoomOAuthEnv();

  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  console.log("[zoom] requesting new OAuth access token");

  let res;
  try {
    res = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      null,
      { headers: { Authorization: `Basic ${basic}` } }
    );
  } catch (err) {
    const zoomMessage = err.response?.data?.reason || err.response?.data?.error || err.message;
    console.error("[zoom] OAuth token request failed:", zoomMessage);
    throw new ZoomAPIError(`Failed to authenticate with Zoom: ${zoomMessage}`, { stage: "oauth_token" });
  }

  cachedToken = res.data.access_token;
  cachedTokenExpiry = Date.now() + res.data.expires_in * 1000;
  console.log(`[zoom] OAuth access token acquired, expires in ${res.data.expires_in}s`);
  return cachedToken;
};

class ZoomProvider extends ILiveProvider {
  async startMeeting({ topic }) {
    const token = await getZoomAccessToken();

    let res;
    try {
      res = await axios.post(
        "https://api.zoom.us/v2/users/me/meetings",
        {
          topic,
          type: 1,
          settings: {
            host_video: true,
            participant_video: false,
            waiting_room: false,
            join_before_host: true,
            // Never mute the host on entry — this mutes the audio channel
            // at the Zoom server level, not just the local UI.
            mute_upon_entry: false,
            audio: "both",
            auto_recording: "none",
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      const zoomMessage = err.response?.data?.message || err.message;
      console.error("[zoom.startMeeting] Failed to create meeting:", zoomMessage);
      throw new ZoomAPIError(`Failed to create the Zoom meeting: ${zoomMessage}`, { stage: "create_meeting" });
    }

    console.log("[zoom.startMeeting] Meeting created:", {
      meetingId: res.data.id,
      hostId: res.data.host_id || "(none returned)",
    });

    return {
      providerMeetingId: String(res.data.id),
      providerMeetingPassword: res.data.password,
      // NEW — the actual Zoom user this meeting is hosted under. Store this
      // so ZAK requests later target the correct identity instead of
      // blindly assuming "me".
      hostZoomUserId: res.data.host_id || null,
    };
  }

  async endMeeting({ providerMeetingId }) {
    const token = await getZoomAccessToken();
    try {
      await axios.put(
        `https://api.zoom.us/v2/meetings/${providerMeetingId}/status`,
        { action: "end" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("[zoom.endMeeting] Meeting ended:", providerMeetingId);
    } catch (err) {
      const zoomCode = err.response?.data?.code;
      const zoomMessage = err.response?.data?.message || err.message;

      // Zoom code 3001 = "Meeting does not exist" — instant meetings can be
      // auto-deleted by Zoom shortly after the host disconnects. That's not
      // a real failure — the meeting is already over on Zoom's side.
      if (zoomCode === 3001) {
        console.warn(
          `[zoom.endMeeting] Meeting ${providerMeetingId} was already ended/removed by Zoom — treating as success.`
        );
        return;
      }

      console.error("[zoom.endMeeting] Failed to end meeting:", zoomMessage);
      throw new ZoomAPIError(`Zoom rejected the end-meeting request: ${zoomMessage}`, {
        stage: "end_meeting",
        zoomCode,
      });
    }
  }

  async generateJoinSignature({ providerMeetingId, role }) {
    return generateZoomSignature({ providerMeetingId, role });
  }

  // Needed so the mentor (host, role=1) is fully authenticated by the
  // Meeting SDK. Without a valid ZAK, host media controls (mic/camera/
  // screen-share) become unreliable even though join() appears to succeed.
  // This now throws on failure instead of returning undefined silently —
  // callers MUST handle mentor joins failing when Zoom rejects this.
  async getZAKToken(zoomUserId = "me") {
    const token = await getZoomAccessToken();
    try {
      const res = await axios.get(
        `https://api.zoom.us/v2/users/${zoomUserId}/token?type=zak`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("[zoom.getZAKToken] ZAK acquired for host user:", zoomUserId);
      return res.data.token;
    } catch (err) {
      const zoomMessage = err.response?.data?.message || err.message;
      console.error(`[zoom.getZAKToken] Failed to fetch ZAK for user "${zoomUserId}":`, zoomMessage);
      throw new ZoomAPIError(`Failed to authenticate the host session with Zoom: ${zoomMessage}`, {
        stage: "zak_token",
        zoomUserId,
      });
    }
  }

  // Distinguishes "meeting genuinely doesn't exist" (Zoom code 3001 / HTTP
  // 404) from transient failures (auth error, network blip, rate limit).
  // Only the former should ever cause us to mark a LiveClass as ended.
  async getMeetingStatus({ providerMeetingId }) {
    const token = await getZoomAccessToken();
    try {
      const res = await axios.get(`https://api.zoom.us/v2/meetings/${providerMeetingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.data.status, notFound: false };
    } catch (err) {
      const zoomCode = err.response?.data?.code;
      const zoomMessage = err.response?.data?.message || err.message;

      if (zoomCode === 3001 || err.response?.status === 404) {
        console.warn(`[zoom.getMeetingStatus] Meeting ${providerMeetingId} not found on Zoom (code ${zoomCode}).`);
        return { status: "not_found", notFound: true };
      }

      console.error("[zoom.getMeetingStatus] Failed to verify meeting status:", zoomMessage);
      throw new ZoomAPIError(`Failed to verify the meeting status with Zoom: ${zoomMessage}`, {
        stage: "meeting_status",
        zoomCode,
      });
    }
  }
}

module.exports = new ZoomProvider();
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn(
    "[LiveKit] LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing",
  );
}

/**
 * Generate a LiveKit access token for a participant.
 *
 * @param {Object} options
 * @param {string} options.identity - Unique user identity
 * @param {string} options.name - Participant display name
 * @param {string} options.roomName - LiveKit room name
 * @param {boolean} options.canPublish - Can publish camera/mic/screen
 * @param {boolean} options.canSubscribe - Can receive other participants
 */
async function createParticipantToken({
  identity,
  name,
  roomName,
  canPublish = true,
  canSubscribe = true,
}) {
  if (!identity) {
    throw new Error("LiveKit participant identity is required");
  }

  if (!roomName) {
    throw new Error("LiveKit room name is required");
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: String(identity),
    name: name || String(identity),
    ttl: "2h",
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe,
    canPublishData: true,
  });

  return await token.toJwt();
}

/**
 * Create LiveKit RoomService client.
 * The server API speaks http(s), while LIVEKIT_URL is normally ws(s).
 */
function getRoomServiceClient() {
  const httpUrl = String(LIVEKIT_URL || "")
    .replace(/^wss:/i, "https:")
    .replace(/^ws:/i, "http:");

  return new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/**
 * Force-closes a LiveKit room: every connected participant (students AND
 * mentor) is disconnected with reason ROOM_DELETED. This is the reliable
 * "class ended for everyone" signal — it does not depend on a student's
 * Socket.IO connection being alive at that moment.
 *
 * Best-effort: never throws. A room that is already empty/gone is fine.
 */
async function closeRoom(roomName) {
  if (!roomName) return false;

  try {
    await getRoomServiceClient().deleteRoom(roomName);
    return true;
  } catch (err) {
    console.warn(`[LiveKit] closeRoom(${roomName}) skipped:`, err.message);
    return false;
  }
}

module.exports = {
  createParticipantToken,
  getRoomServiceClient,
  closeRoom,
};
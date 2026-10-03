// modules/live-class/services/providerSelector.js

const LIVE_PROVIDER = (process.env.LIVE_PROVIDER || "livekit").toLowerCase();

const getProvider = () => {
  switch (LIVE_PROVIDER) {
    case "livekit":
      return require("./livekit.service");
    default:
      throw new Error(`Unknown LIVE_PROVIDER: "${LIVE_PROVIDER}"`);
  }
};

module.exports = { getProvider };
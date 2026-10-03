// // modules/live-class/services/index.js

// const LIVE_PROVIDER = process.env.LIVE_PROVIDER || "zoom";

// const getProvider = () => {
//   switch (LIVE_PROVIDER) {
//     case "zoom":
//       return require("./zoom.provider");
//     default:
//       throw new Error(`Unknown LIVE_PROVIDER: "${LIVE_PROVIDER}"`);
//   }
// };

// module.exports = {
//   getProvider,
//   liveClassService: require("./liveClass.service"),
//   attendanceService: require("./attendance.service"),
// };


// modules/live-class/services/index.js

const { getProvider } = require("./providerSelector");
const liveClassService = require("./liveClass.service");
const attendanceService = require("./attendance.service");

module.exports = {
  getProvider,
  liveClassService,
  attendanceService,
};
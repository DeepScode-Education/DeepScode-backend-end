// modules/live-class/index.js

const liveClassRoutes = require("./routes/liveClass.routes");
const { registerLiveClassSockets } = require("./sockets/liveClass.socket");



module.exports = {
  liveClassRoutes,
  registerLiveClassSockets,
};
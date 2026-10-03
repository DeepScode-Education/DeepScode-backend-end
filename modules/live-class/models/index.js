// modules/live-class/models/index.js

// module.exports = {
//   LiveClass: require("./LiveClass"),
//   Attendance: require("./Attendance"),
// };



// modules/live-class/models/index.js
module.exports = {
  LiveClass: require("./LiveClass"),
  Attendance: require("./Attendance"), // still exported as `Attendance` locally — only the Mongoose model name changed
};
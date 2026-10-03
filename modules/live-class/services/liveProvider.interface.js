// // modules/live-class/services/liveProvider.interface.js

// class ILiveProvider {
//   async startMeeting({ topic, hostEmail }) {
//     throw new Error("startMeeting() not implemented");
//   }
//   async endMeeting({ providerMeetingId }) {
//     throw new Error("endMeeting() not implemented");
//   }
//   async generateJoinSignature({ providerMeetingId, role }) {
//     throw new Error("generateJoinSignature() not implemented");
//   }
//   async getMeetingStatus({ providerMeetingId }) {
//     throw new Error("getMeetingStatus() not implemented");
//   }
// }

// module.exports = ILiveProvider;





// modules/live-class/services/liveProvider.interface.js
class ILiveProvider {
  async startMeeting({ topic, hostEmail }) {
    throw new Error("startMeeting() not implemented");
  }
  async endMeeting({ providerMeetingId }) {
    throw new Error("endMeeting() not implemented");
  }
  async generateJoinSignature({ providerMeetingId, role }) {
    throw new Error("generateJoinSignature() not implemented");
  }
  async getZAKToken(zoomUserId) {
    throw new Error("getZAKToken() not implemented");
  }
  async getMeetingStatus({ providerMeetingId }) {
    throw new Error("getMeetingStatus() not implemented");
  }
}

module.exports = ILiveProvider;
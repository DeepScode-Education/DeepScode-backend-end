const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,

  socket: {
    keepAlive: true,
    connectTimeout: 10000,

    reconnectStrategy: (retries) => {
      console.log(`🔄 Redis reconnect attempt: ${retries}`);

      // Maximum 20 retries
      if (retries > 20) {
        console.error("❌ Redis reconnect limit reached.");
        return false;
      }

      // Exponential backoff (max 3 sec)
      return Math.min(retries * 200, 3000);
    },
  },
});

// ===== Events =====

redisClient.on("connect", () => {
  console.log("🟡 Redis connecting...");
});

redisClient.on("ready", () => {
  console.log("🟢 Redis Ready 🚀");
});

redisClient.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

redisClient.on("end", () => {
  console.warn("🔴 Redis connection closed");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Error:", err.message);
});

// ===== Connect Function =====

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    console.error("❌ Failed to connect Redis:", err.message);
  }
};

module.exports = {
  redisClient,
  connectRedis,
};
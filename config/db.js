const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    console.log("🚀 MongoDB Connected");

 
    const db = mongoose.connection;

    const collections = await db.db.listCollections({ name: "users" }).toArray();

    if (collections.length > 0) {
      const indexes = await db.collection("users").indexes();

      const hasPhoneIndex = indexes.some(
        (idx) => idx.name === "phone_1"
      );

      if (hasPhoneIndex) {
        await db.collection("users").dropIndex("phone_1");
        console.log("🧹 Removed stale 'phone_1' index");
      }
    }
  } catch (error) {
    console.log("❌ MongoDB Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
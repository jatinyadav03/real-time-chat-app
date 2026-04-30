const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServerInstance = null;

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === "production";
  const mongoUri = process.env.MONGODB_URI;

  if (isProduction && !mongoUri) {
    console.error("Missing MONGODB_URI in production environment");
    return false;
  }

  const localFallbackUri = "mongodb://127.0.0.1:27017/realtime_chat";
  const resolvedMongoUri = mongoUri || localFallbackUri;

  try {
    await mongoose.connect(resolvedMongoUri);
    console.log("MongoDB connected successfully");
    return true;
  } catch (primaryError) {
    if (isProduction) {
      console.error("MongoDB connection failed in production:", primaryError.message);
      return false;
    }

    console.warn(
      "Primary MongoDB not reachable. Starting in-memory MongoDB:",
      primaryError.message
    );

    try {
      memoryServerInstance = await MongoMemoryServer.create();
      const memoryUri = memoryServerInstance.getUri();

      await mongoose.connect(memoryUri);
      console.log("In-memory MongoDB connected successfully");
      return true;
    } catch (memoryError) {
      console.error(
        "MongoDB connection failed. Running in no-DB mode:",
        memoryError.message
      );
      return false;
    }
  }
};

module.exports = connectDB;

import mongoose from "mongoose";

export async function connectDatabase() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "astroai"
  });
}

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDatabase } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3303);

app.set("trust proxy", 1);
app.use(
  cors({
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Internal server error."
  });
});

async function start() {
  await connectDatabase();
  app.listen(port, "0.0.0.0", () => {
    console.log(`AstroAI API running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

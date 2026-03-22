import crypto from "crypto";
import jwt from "jsonwebtoken";

export function generateRandomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createAccessToken({ userId, sessionId }) {
  return jwt.sign(
    {
      userId,
      sessionId
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_TTL || "15m"
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

export function getRefreshExpiryDate() {
  const days = Number(process.env.REFRESH_TOKEN_DAYS || 30);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

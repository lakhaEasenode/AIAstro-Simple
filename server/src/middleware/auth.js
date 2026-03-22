import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { verifyAccessToken } from "../utils/tokens.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({
      error: "Authentication required.",
      code: "AUTH_REQUIRED"
    });
  }

  try {
    const payload = verifyAccessToken(token);
    const session = await Session.findById(payload.sessionId);

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        error: "Session expired.",
        code: "SESSION_EXPIRED"
      });
    }

    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({
        error: "User not found.",
        code: "AUTH_REQUIRED"
      });
    }

    session.lastSeenAt = new Date();
    await session.save();

    req.user = user;
    req.session = session;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid token.",
      code: "INVALID_TOKEN"
    });
  }
}

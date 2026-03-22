import bcrypt from "bcryptjs";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { VerificationToken } from "../models/VerificationToken.js";
import { sendVerificationEmail } from "../utils/email.js";
import { sanitizeUser } from "../utils/formatters.js";
import {
  createAccessToken,
  generateRandomToken,
  getRefreshExpiryDate,
  hashToken
} from "../utils/tokens.js";

async function createAndSendVerification(user) {
  await VerificationToken.deleteMany({ userId: user._id });

  const rawToken = generateRandomToken();
  await VerificationToken.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  const verificationLink = `${process.env.CLIENT_URL}?verify=${rawToken}`;

  await sendVerificationEmail({
    email: user.email,
    name: user.name,
    verificationLink
  });
}

async function createSessionResponse(user, req) {
  const refreshToken = generateRandomToken();
  const session = await Session.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    userAgent: req.headers["user-agent"] || "",
    ipAddress: req.ip,
    expiresAt: getRefreshExpiryDate()
  });

  return {
    user: sanitizeUser(user),
    accessToken: createAccessToken({
      userId: user._id.toString(),
      sessionId: session._id.toString()
    }),
    refreshToken
  };
}

export async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({
      error: "Name, email, and password are required."
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({
      error: "An account with this email already exists."
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash
  });

  await createAndSendVerification(user);

  return res.status(201).json({
    message: "Account created. Check your email to verify your account."
  });
}

export async function resendVerificationEmail(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase().trim() });

  if (!user) {
    return res.status(404).json({
      error: "No account found for this email."
    });
  }

  if (user.isVerified) {
    return res.json({
      message: "This email is already verified."
    });
  }

  await createAndSendVerification(user);

  return res.json({
    message: "Verification email sent again."
  });
}

export async function verifyEmail(req, res) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: "Verification token is required."
    });
  }

  const verificationToken = await VerificationToken.findOne({
    tokenHash: hashToken(token)
  });

  if (!verificationToken || verificationToken.expiresAt < new Date()) {
    return res.status(400).json({
      error: "Verification link is invalid or expired."
    });
  }

  const user = await User.findById(verificationToken.userId);
  if (!user) {
    return res.status(404).json({
      error: "User not found."
    });
  }

  user.isVerified = true;
  await user.save();
  await VerificationToken.deleteMany({ userId: user._id });

  return res.json({
    message: "Email verified. You can log in now."
  });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase().trim() });

  if (!user) {
    return res.status(400).json({
      error: "Invalid email or password."
    });
  }

  const passwordMatches = await bcrypt.compare(password || "", user.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({
      error: "Invalid email or password."
    });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      error: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED"
    });
  }

  return res.json(await createSessionResponse(user, req));
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: "Refresh token is required."
    });
  }

  const session = await Session.findOne({
    tokenHash: hashToken(refreshToken)
  });

  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({
      error: "Refresh session expired.",
      code: "SESSION_EXPIRED"
    });
  }

  const user = await User.findById(session.userId);
  if (!user) {
    return res.status(401).json({
      error: "User not found."
    });
  }

  session.lastSeenAt = new Date();
  await session.save();

  return res.json({
    accessToken: createAccessToken({
      userId: user._id.toString(),
      sessionId: session._id.toString()
    }),
    refreshToken
  });
}

export async function logout(req, res) {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await Session.deleteOne({
      tokenHash: hashToken(refreshToken)
    });
  }

  return res.json({
    message: "Logged out."
  });
}

export async function me(req, res) {
  return res.json({
    user: sanitizeUser(req.user)
  });
}

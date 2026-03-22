export function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt
  };
}

export function createChatTitle(text) {
  const cleaned = (text || "").trim();
  if (!cleaned) {
    return "New Reading";
  }

  const compact = cleaned.replace(/\s+/g, " ");
  return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact;
}

export function normalizeAssistantAnswer(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
}

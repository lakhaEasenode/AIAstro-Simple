const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3303/api";

const ACCESS_TOKEN_KEY = "astroai_access_token";
const REFRESH_TOKEN_KEY = "astroai_refresh_token";

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    clearTokens();
    return false;
  }

  const data = await response.json();
  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || refreshToken
  });

  return true;
}

async function request(pathname, options = {}, allowRefresh = true) {
  const headers = new Headers(options.headers || {});
  const body = options.body;
  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    ...options,
    headers
  });

  if (response.status === 401 && allowRefresh && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request(pathname, options, false);
    }
  }

  return response;
}

async function parseResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.code = data.code || "REQUEST_FAILED";
    throw error;
  }

  return data;
}

export async function registerUser(payload) {
  const response = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function resendVerification(email) {
  const response = await request("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email })
  });

  return parseResponse(response);
}

export async function verifyEmailToken(token) {
  const response = await request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token })
  });

  return parseResponse(response);
}

export async function loginUser(payload) {
  const response = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const data = await parseResponse(response);
  setTokens(data);
  return data;
}

export async function logoutUser() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      }, false);
    } catch (error) {
      // Ignore logout request failures during local cleanup.
    }
  }

  clearTokens();
}

export async function getCurrentUser() {
  const response = await request("/auth/me");
  return parseResponse(response);
}

export async function getChats() {
  const response = await request("/chats");
  return parseResponse(response);
}

export async function getChatMessages(chatId) {
  const response = await request(`/chats/${chatId}/messages`);
  return parseResponse(response);
}

export async function sendChatMessage({ chatId, text, imageFile }) {
  const body = new FormData();

  if (chatId) {
    body.append("chatId", chatId);
  }

  body.append("text", text || "");

  if (imageFile) {
    body.append("image", imageFile);
  }

  const response = await request("/chats/message", {
    method: "POST",
    body
  });

  return parseResponse(response);
}

export async function deleteChat(chatId) {
  const response = await request(`/chats/${chatId}`, {
    method: "DELETE"
  });

  return parseResponse(response);
}

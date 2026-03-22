import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteChat,
  getChatMessages,
  getChats,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
  sendChatMessage,
  verifyEmailToken
} from "./api";

const QUICK_QUESTIONS = [
  "What does this suggest for my career?",
  "क्या मेरे लिए आने वाला समय अच्छा रहेगा?",
  "Give me a short reading from this image",
  "मेरे रिश्तों के बारे में संक्षेप में बताओ"
];

const INITIAL_AUTH_FORM = {
  name: "",
  email: "",
  password: ""
};

const INITIAL_CHAT_FORM = {
  text: ""
};

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(INITIAL_AUTH_FORM);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationState, setVerificationState] = useState({
    loading: false,
    status: "",
    error: ""
  });

  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatForm, setChatForm] = useState(INITIAL_CHAT_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const textareaRef = useRef(null);
  const threadRef = useRef(null);
  const profileMenuRef = useRef(null);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify");

    if (!token) {
      return;
    }

    setVerificationState({
      loading: true,
      status: "",
      error: ""
    });

    verifyEmailToken(token)
      .then((data) => {
        setVerificationState({
          loading: false,
          status: data.message,
          error: ""
        });
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((error) => {
        setVerificationState({
          loading: false,
          status: "",
          error: error.message
        });
      });
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const data = await getCurrentUser();
        setUser(data.user);
        const chatsData = await getChats();
        setChats(chatsData.chats);
        if (chatsData.chats[0]) {
          setActiveChatId(chatsData.chats[0]._id);
        }
      } catch (error) {
        setUser(null);
      } finally {
        setBootstrapping(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return undefined;
    }

    let active = true;
    const reader = new FileReader();

    reader.onload = () => {
      if (active) {
        setImagePreview(String(reader.result || ""));
      }
    };

    reader.readAsDataURL(imageFile);

    return () => {
      active = false;
    };
  }, [imageFile]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [chatForm.text]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, imagePreview]);

  useEffect(() => {
    if (!user || !activeChatId) {
      return;
    }

    setMessagesLoading(true);
    setChatError("");

    getChatMessages(activeChatId)
      .then((data) => {
        setMessages(data.messages);
      })
      .catch((error) => {
        setChatError(error.message);
      })
      .finally(() => {
        setMessagesLoading(false);
      });
  }, [user, activeChatId]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const canSend = useMemo(() => {
    return Boolean(chatForm.text.trim() || imageFile);
  }, [chatForm.text, imageFile]);

  function updateAuthField(field, value) {
    setAuthForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateChatField(value) {
    setChatForm({ text: value });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (authLoading) {
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      if (authMode === "register") {
        const data = await registerUser(authForm);
        setVerificationEmail(authForm.email);
        setAuthMessage(data.message);
        setAuthForm(INITIAL_AUTH_FORM);
        setAuthMode("login");
      } else {
        const data = await loginUser({
          email: authForm.email,
          password: authForm.password
        });

        setUser(data.user);
        setVerificationEmail("");
        setAuthForm(INITIAL_AUTH_FORM);
        setAuthMessage("");
        const chatsData = await getChats();
        setChats(chatsData.chats);
        setActiveChatId(chatsData.chats[0]?._id || "");
      }
    } catch (error) {
      setAuthError(error.message);
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setVerificationEmail(authForm.email);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!verificationEmail) {
      return;
    }

    try {
      const data = await resendVerification(verificationEmail);
      setAuthMessage(data.message);
      setAuthError("");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleLogout() {
    await logoutUser();
    setProfileMenuOpen(false);
    setUser(null);
    setChats([]);
    setActiveChatId("");
    setMessages([]);
    setChatForm(INITIAL_CHAT_FORM);
    setImageFile(null);
    setImagePreview("");
  }

  function handleNewChat() {
    setActiveChatId("");
    setMessages([]);
    setSidebarOpen(false);
    setChatError("");
  }

  async function handleDeleteChat(chatId) {
    try {
      await deleteChat(chatId);
      const nextChats = chats.filter((chat) => chat._id !== chatId);
      setChats(nextChats);
      if (activeChatId === chatId) {
        setActiveChatId(nextChats[0]?._id || "");
        if (!nextChats.length) {
          setMessages([]);
        }
      }
    } catch (error) {
      setChatError(error.message);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!canSend || sending) {
      return;
    }

    const draftText = chatForm.text.trim();
    const tempUserMessage = {
      _id: `temp-user-${Date.now()}`,
      role: "user",
      content: draftText || "Please read this image.",
      imagePreview,
      createdAt: new Date().toISOString()
    };
    const tempAssistantMessage = {
      _id: `temp-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      pending: true,
      createdAt: new Date().toISOString()
    };

    setSending(true);
    setChatError("");
    setMessages((current) => [...current, tempUserMessage, tempAssistantMessage]);

    try {
      const currentImagePreview = imagePreview;
      const data = await sendChatMessage({
        chatId: activeChatId,
        text: draftText,
        imageFile
      });

      setChats((current) => {
        const remaining = current.filter((chat) => chat._id !== data.chat._id);
        return [data.chat, ...remaining];
      });
      setActiveChatId(data.chat._id);
      setMessages((current) =>
        current
          .filter((message) => !message._id.startsWith("temp-"))
          .concat([
            {
              ...data.userMessage,
              imagePreview: currentImagePreview || ""
            },
            data.assistantMessage
          ])
      );
      setChatForm(INITIAL_CHAT_FORM);
      setImageFile(null);
      setImagePreview("");
    } catch (error) {
      setChatError(error.message);
      setMessages((current) =>
        current.map((message) =>
          message._id === tempAssistantMessage._id
            ? { ...message, pending: false, content: error.message }
            : message
        )
      );
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend && !sending) {
        handleSendMessage(event);
      }
    }
  }

  if (bootstrapping) {
    return (
      <div className="page-shell">
        <main className="shell loading-shell">
          <div className="loading-card">
            <div className="typing-indicator">
              <span className="pulse-dot" />
              <span className="pulse-dot" />
              <span className="pulse-dot" />
            </div>
            <p>Loading AstroAI...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell">
        <main className="auth-shell">
          <section className="hero-panel">
            <p className="eyebrow">AstroAI</p>
            <h1>Hosted-ready astrology chat with user accounts.</h1>
            <p className="hero-copy">
              Sign in to keep your personal chat history, email verification,
              and AI context linked to your account.
            </p>
            <div className="hero-tags">
              <span className="pill">Email verification</span>
              <span className="pill">Per-user history</span>
              <span className="pill">Server-side OpenAI</span>
            </div>
          </section>

          <section className="auth-card">
            {verificationState.loading || verificationState.status || verificationState.error ? (
              <div className={`notice ${verificationState.error ? "notice-error" : "notice-success"}`}>
                {verificationState.loading
                  ? "Verifying your email..."
                  : verificationState.error || verificationState.status}
              </div>
            ) : null}

            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                className={authMode === "register" ? "auth-tab active" : "auth-tab"}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "register" ? (
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(event) => updateAuthField("name", event.target.value)}
                    required
                  />
                </label>
              ) : null}

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => updateAuthField("email", event.target.value)}
                  required
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => updateAuthField("password", event.target.value)}
                  required
                />
              </label>

              <button className="primary-button full-width" type="submit" disabled={authLoading}>
                {authLoading ? "Please wait..." : authMode === "register" ? "Create account" : "Login"}
              </button>
            </form>

            {authMessage ? <div className="notice notice-success">{authMessage}</div> : null}
            {authError ? <div className="notice notice-error">{authError}</div> : null}

            {verificationEmail ? (
              <button className="secondary-button" type="button" onClick={handleResendVerification}>
                Resend verification email
              </button>
            ) : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <main className="chat-layout">
        <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
          <div className="sidebar-top">
            <div>
              <p className="eyebrow">AstroAI</p>
              <h2>{firstName}</h2>
              <p className="muted-copy">{user.email}</p>
            </div>
          </div>

          <button className="primary-button full-width" type="button" onClick={handleNewChat}>
            New Chat
          </button>

          <div className="chat-list">
            {chats.length ? (
              chats.map((chat) => (
                <article
                  key={chat._id}
                  className={chat._id === activeChatId ? "chat-item active" : "chat-item"}
                  onClick={() => {
                    setActiveChatId(chat._id);
                    setSidebarOpen(false);
                  }}
                >
                  <div>
                    <h3>{chat.title}</h3>
                    <p>{chat.lastMessagePreview || "No messages yet"}</p>
                  </div>
                  <button
                    className="chat-delete"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteChat(chat._id);
                    }}
                  >
                    Remove
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state small">No chats yet. Start your first reading.</div>
            )}
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <div className="chat-header-left">
              <button className="secondary-button compact mobile-only" type="button" onClick={() => setSidebarOpen((current) => !current)}>
                Menu
              </button>
            </div>
            <div>
              <p className="eyebrow">Logged In</p>
              <h1>{activeChatId ? "Conversation" : "Start A New Reading"}</h1>
            </div>
            <div className="profile-menu profile-menu-right" ref={profileMenuRef}>
              <button
                className="profile-trigger"
                type="button"
                onClick={() => setProfileMenuOpen((current) => !current)}
                aria-label="Open profile menu"
              >
                {user.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </button>

              {profileMenuOpen ? (
                <div className="profile-dropdown">
                  <p className="profile-name">{firstName}</p>
                  <p className="profile-email">{user.email}</p>
                  <button className="secondary-button full-width" type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <div className="thread-view" ref={threadRef}>
            {messagesLoading ? (
              <div className="empty-state">
                <div className="typing-indicator">
                  <span className="pulse-dot" />
                  <span className="pulse-dot" />
                  <span className="pulse-dot" />
                </div>
              </div>
            ) : messages.length ? (
              messages.map((message) => (
                <article key={message._id} className={`message-row message-row-${message.role}`}>
                  <div className={`message-bubble message-bubble-${message.role}`}>
                    {message.imagePreview ? (
                      <img src={message.imagePreview} alt="Uploaded preview" className="message-image" />
                    ) : null}
                    {message.pending ? (
                      <div className="typing-indicator">
                        <span className="pulse-dot" />
                        <span className="pulse-dot" />
                        <span className="pulse-dot" />
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <p className="empty-title">Ask your first question</p>
                <div className="starter-row">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      className="quick-chip"
                      type="button"
                      onClick={() => updateChatField(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form className="composer-wrap" onSubmit={handleSendMessage}>
            {imagePreview ? (
              <div className="composer-preview">
                <img src={imagePreview} alt="Selected upload preview" />
              </div>
            ) : null}

            <div className="composer">
              <textarea
                ref={textareaRef}
                rows="1"
                value={chatForm.text}
                onChange={(event) => updateChatField(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask in English or Hindi. Your chats are saved to your account."
              />

              <div className="composer-actions">
                <label className="icon-button upload-icon" htmlFor="chat-image" title="Upload image">
                  <input
                    id="chat-image"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                  />
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 16V7m0 0 3.5 3.5M12 7 8.5 10.5M7 17.5h10a3.5 3.5 0 0 0 0-7h-.6A5 5 0 0 0 7 11a3.5 3.5 0 0 0 0 7Z" />
                  </svg>
                </label>

                <button className="icon-button send-button" type="submit" disabled={!canSend || sending}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12 20 4l-4 16-4.5-5.5L4 12Z" />
                  </svg>
                </button>
              </div>
            </div>

            {chatError ? <p className="error-text">{chatError}</p> : null}
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;

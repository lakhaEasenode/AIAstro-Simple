import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";
import { generateAstroReply } from "../services/openai.js";
import { createChatTitle } from "../utils/formatters.js";

async function getOwnedChat(chatId, userId) {
  return Chat.findOne({
    _id: chatId,
    userId
  });
}

export async function listChats(req, res) {
  const chats = await Chat.find({ userId: req.user._id }).sort({ lastMessageAt: -1 });
  return res.json({ chats });
}

export async function getMessages(req, res) {
  const chat = await getOwnedChat(req.params.chatId, req.user._id);
  if (!chat) {
    return res.status(404).json({
      error: "Chat not found."
    });
  }

  const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
  return res.json({ messages });
}

export async function sendMessage(req, res) {
  const text = String(req.body.text || "").trim();
  const chatId = String(req.body.chatId || "").trim();

  if (!text && !req.file) {
    return res.status(400).json({
      error: "Send a message or upload an image."
    });
  }

  let chat;

  if (chatId) {
    chat = await getOwnedChat(chatId, req.user._id);
    if (!chat) {
      return res.status(404).json({
        error: "Chat not found."
      });
    }
  } else {
    chat = await Chat.create({
      userId: req.user._id,
      title: createChatTitle(text),
      lastMessagePreview: text || "Image reading",
      lastMessageAt: new Date()
    });
  }

  const userMessage = await Message.create({
    chatId: chat._id,
    userId: req.user._id,
    role: "user",
    content: text || "Please read this image.",
    hasImage: Boolean(req.file),
    imageName: req.file?.originalname || ""
  });

  const history = await Message.find({ chatId: chat._id, _id: { $ne: userMessage._id } })
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  const assistantText = await generateAstroReply({
    user: req.user,
    history: history.reverse(),
    text,
    imageFile: req.file || null
  });

  const assistantMessage = await Message.create({
    chatId: chat._id,
    userId: req.user._id,
    role: "assistant",
    content: assistantText
  });

  chat.lastMessagePreview = assistantText;
  chat.lastMessageAt = assistantMessage.createdAt;
  if (!chat.title || chat.title === "New Reading") {
    chat.title = createChatTitle(text || assistantText);
  }
  await chat.save();

  return res.status(201).json({
    chat,
    userMessage,
    assistantMessage
  });
}

export async function removeChat(req, res) {
  const chat = await getOwnedChat(req.params.chatId, req.user._id);
  if (!chat) {
    return res.status(404).json({
      error: "Chat not found."
    });
  }

  await Message.deleteMany({ chatId: chat._id });
  await chat.deleteOne();

  return res.json({
    message: "Chat deleted."
  });
}

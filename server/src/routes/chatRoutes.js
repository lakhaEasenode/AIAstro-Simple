import { Router } from "express";
import multer from "multer";
import { getMessages, listChats, removeChat, sendMessage } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

router.use(requireAuth);
router.get("/", listChats);
router.get("/:chatId/messages", getMessages);
router.post("/message", upload.single("image"), sendMessage);
router.delete("/:chatId", removeChat);

export default router;

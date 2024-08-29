import express from "express";
import {
  getInboxMessages,
  getSentMessages,
  getSingleUserMessage,
  getUserById,
} from "../controller/userController.js";
const router = express.Router();
router.get("/user", getInboxMessages);
router.get("/user/:id", getUserById);
router.get("/sent", getSentMessages);
router.get("/messages/:id1/:id2", getSingleUserMessage);
export default router;

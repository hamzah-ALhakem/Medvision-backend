import express from 'express';
import { getNotifications, markRead, markOneRead, markChatRead } from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Define Routes
router.get('/', authenticateToken, getNotifications);
router.put('/read', authenticateToken, markRead); // Mark All
router.put('/:id/read', authenticateToken, markOneRead); // Mark One
router.put('/chat/:senderId', authenticateToken, markChatRead); // Mark Chat Thread ✅

export default router;
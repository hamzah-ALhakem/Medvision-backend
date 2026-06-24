import express from 'express';
import { sendMessage, getMessages, getContacts } from '../controllers/message.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { sendMessageValidation, validate } from '../middleware/validators.js';

const router = express.Router();

router.post('/', authenticateToken, sendMessageValidation, validate, sendMessage);
router.get('/contacts', authenticateToken, getContacts);
router.get('/:userId', authenticateToken, getMessages);

export default router;
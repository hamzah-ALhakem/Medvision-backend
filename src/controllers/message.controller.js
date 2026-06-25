import * as messageService from '../services/message.service.js';
import * as notificationService from '../services/notification.service.js';
import pusher from '../config/pusher.js';

// 1. Send Message
export const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const receiverId = parseInt(req.body.receiverId);
        const senderId = parseInt(req.user.id);

        if (isNaN(receiverId) || isNaN(senderId)) {
            return res.status(400).json({ message: 'Invalid User IDs' });
        }

        // Permission check
        const hasPermission = await messageService.checkPermission(senderId, receiverId);
        if (!hasPermission) {
            return res.status(403).json({ message: 'Messaging requires a confirmed appointment.' });
        }

        const newMessage = await messageService.sendMessage({ senderId, receiverId, content });

        // Create notification
        try {
            const senderName = await messageService.getSenderName(senderId);
            const notification = await notificationService.createNotification({
                userId: receiverId,
                type: 'message',
                relatedId: senderId,
                message: `\u0631\u0633\u0627\u0644\u0629 \u062c\u062f\u064a\u062f\u0629 \u0645\u0646 ${senderName}: ${content.substring(0, 30)}...`
            });

            pusher.trigger(`user_${receiverId}`, 'receive_message', newMessage);
            pusher.trigger(`user_${receiverId}`, 'receive_notification', notification);
        } catch (notifError) {
            console.error('Notification creation failed:', notifError);
        }

        res.json(newMessage);

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// 2. Get Messages
export const getMessages = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = parseInt(req.params.userId);
        const messages = await messageService.getMessages(myId, otherId);
        res.json(messages);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// 3. Get Contacts (optimized)
export const getContacts = async (req, res) => {
    try {
        const contacts = await messageService.getContacts(req.user.id);
        res.json(contacts);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};
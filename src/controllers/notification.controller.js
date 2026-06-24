import * as notificationService from '../services/notification.service.js';

export const getNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.getNotifications(req.user.id);
        res.json(notifications);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

export const markRead = async (req, res) => {
    try {
        await notificationService.markAllRead(req.user.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

export const markOneRead = async (req, res) => {
    try {
        const { id } = req.params;
        await notificationService.markOneRead(parseInt(id), req.user.id);
        res.json({ success: true });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Server Error' });
    }
};

export const markChatRead = async (req, res) => {
    try {
        const { senderId } = req.params;
        await notificationService.markChatRead(req.user.id, parseInt(senderId));
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// Re-export helper for backward compatibility
export const createNotification = notificationService.createNotification;
import prisma from '../config/prisma.js';

// 1. Get Notifications
export const getNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(notifications);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// 2. Mark All Read
export const markRead = async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// 3. Mark One Read
export const markOneRead = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.update({
            where: { id: parseInt(id) },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// 4. Mark Chat Notifications Read (Corrected) ✅
export const markChatRead = async (req, res) => {
    try {
        const { senderId } = req.params;
        
        await prisma.notification.updateMany({
            where: { 
                userId: req.user.id, 
                type: 'message', // ✅ نبحث عن النوع الثابت
                relatedId: parseInt(senderId), // ✅ ونستخدم الرقم المرتبط
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// Helper
export const createNotification = async (userId, message, type = 'info', relatedId = null) => {
    try {
        await prisma.notification.create({
            data: { userId, message, type, relatedId, isRead: false }
        });
    } catch (err) { console.error("Notification Helper Error:", err); }
};
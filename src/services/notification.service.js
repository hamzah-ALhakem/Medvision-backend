import prisma from '../config/prisma.js';

export const getNotifications = async (userId) => {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
};

export const markAllRead = async (userId) => {
    return prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
    });
};

export const markOneRead = async (notificationId, userId) => {
    const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId }
    });

    if (!notification) {
        const error = new Error('Notification not found');
        error.statusCode = 404;
        throw error;
    }

    return prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
    });
};

export const markChatRead = async (userId, senderId) => {
    return prisma.notification.updateMany({
        where: {
            userId,
            type: 'message',
            relatedId: senderId,
            isRead: false
        },
        data: { isRead: true }
    });
};

export const createNotification = async ({ userId, message, type = 'info', relatedId = null }) => {
    return prisma.notification.create({
        data: { userId, message, type, relatedId, isRead: false }
    });
};

export const markAppointmentNotificationsRead = async (doctorId, appointmentId) => {
    return prisma.notification.updateMany({
        where: {
            userId: doctorId,
            type: 'appointment',
            relatedId: appointmentId,
            isRead: false
        },
        data: { isRead: true }
    });
};

import prisma from '../config/prisma.js';

// Check messaging permission (requires confirmed appointment)
export const checkPermission = async (senderId, receiverId) => {
    const permissionCheck = await prisma.appointment.findFirst({
        where: {
            status: 'CONFIRMED',
            OR: [
                { patientId: senderId, doctorId: receiverId },
                { patientId: receiverId, doctorId: senderId }
            ]
        }
    });
    return !!permissionCheck;
};

// Send a message
export const sendMessage = async ({ senderId, receiverId, content }) => {
    const newMessage = await prisma.message.create({
        data: { senderId, receiverId, content, isRead: false }
    });
    return newMessage;
};

// Get messages between two users
export const getMessages = async (myId, otherId) => {
    return prisma.message.findMany({
        where: {
            OR: [
                { senderId: myId, receiverId: otherId },
                { senderId: otherId, receiverId: myId }
            ]
        },
        orderBy: { createdAt: 'asc' }
    });
};

// Get contacts — optimized with distinct
export const getContacts = async (myId) => {
    // Get distinct user IDs from messages
    const sentTo = await prisma.message.findMany({
        where: { senderId: myId },
        distinct: ['receiverId'],
        select: { receiverId: true },
        orderBy: { createdAt: 'desc' }
    });

    const receivedFrom = await prisma.message.findMany({
        where: { receiverId: myId },
        distinct: ['senderId'],
        select: { senderId: true },
        orderBy: { createdAt: 'desc' }
    });

    // Merge unique IDs
    const contactIds = new Set([
        ...sentTo.map(m => m.receiverId),
        ...receivedFrom.map(m => m.senderId)
    ]);

    if (contactIds.size === 0) return [];

    // Fetch user details in one query
    const contacts = await prisma.user.findMany({
        where: { id: { in: Array.from(contactIds) } },
        select: { id: true, firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true, role: true, specialtyEn: true, specialtyAr: true }
    });

    return contacts;
};

// Get sender name
export const getSenderName = async (senderId) => {
    const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true }
    });
    return sender || null;
};

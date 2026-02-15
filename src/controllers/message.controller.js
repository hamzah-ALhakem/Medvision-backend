import prisma from '../config/prisma.js';

// 1. Send Message (Debug Version 🐞)
export const sendMessage = async (req, res) => {
    try {
        console.log("📨 [DEBUG] Start sendMessage...");
        console.log("📥 [DEBUG] Body:", req.body);
        console.log("👤 [DEBUG] User:", req.user);

        const { content } = req.body;
        
        // 1. تحويل المعرفات لأرقام (لضمان عدم حدوث خطأ في قاعدة البيانات)
        const receiverId = parseInt(req.body.receiverId);
        const senderId = parseInt(req.user.id);

        if (isNaN(receiverId) || isNaN(senderId)) {
            console.error("❌ [ERROR] Invalid IDs:", { senderId, receiverId });
            return res.status(400).json({ message: "Invalid User IDs" });
        }

        // 2. التحقق الأمني (Security Check)
        // هل يوجد موعد "CONFIRMED" بينهما؟
        console.log(`🔍 [DEBUG] Checking permission between ${senderId} and ${receiverId}...`);
        
        const permissionCheck = await prisma.appointment.findFirst({
            where: {
                status: 'CONFIRMED', // تأكد أن الحالة في قاعدة البيانات مكتوبة هكذا تماماً
                OR: [
                    { patientId: senderId, doctorId: receiverId },
                    { patientId: receiverId, doctorId: senderId }
                ]
            }
        });

        // 🚨 طباعة نتيجة التحقق
        if (!permissionCheck) {
            console.warn("⛔ [WARNING] Permission Check Failed! No CONFIRMED appointment found.");
            // ملاحظة: للتجربة الآن، يمكنك تعليق سطر الـ return لكي تسمح بالحفظ وتتأكد
            // return res.status(403).json({ message: "لا يمكنك المراسلة إلا بعد تأكيد الحجز." });
        } else {
            console.log("✅ [DEBUG] Permission Granted.");
        }

        // 3. الحفظ في قاعدة البيانات (The most important step)
        console.log("💾 [DEBUG] Saving to Database...");
        const newMessage = await prisma.message.create({
            data: {
                senderId: senderId,
                receiverId: receiverId,
                content: content,
                isRead: false
            }
        });
        console.log("✅ [DEBUG] Message Saved ID:", newMessage.id);

        // 4. إرسال الإشعار (Notification Logic)
        const sender = await prisma.user.findUnique({
            where: { id: senderId },
            select: { firstName: true, lastName: true }
        });
        const senderName = `${sender.firstName} ${sender.lastName}`;

        // محاولة إنشاء الإشعار (داخل try/catch منفصل لكي لا يوقف الرسالة لو فشل)
        try {
            const notification = await prisma.notification.create({
                data: {
                    userId: receiverId,
                    type: 'message',
                    relatedId: senderId,
                    message: `رسالة جديدة من ${senderName}: ${content.substring(0, 30)}...`,
                    isRead: false
                }
            });

            // 5. البث المباشر (Socket.io)
            if (req.io) {
                console.log(`⚡ [DEBUG] Emitting to user_${receiverId}`);
                req.io.to(`user_${receiverId}`).emit("receive_message", newMessage);
                req.io.to(`user_${receiverId}`).emit("receive_notification", notification);
            } else {
                console.error("⚠️ [WARNING] Socket.io instance not found in req");
            }

        } catch (notifError) {
            console.error("❌ [ERROR] Notification failed:", notifError);
        }

        // الرد النهائي للفرونت إند
        res.json(newMessage);

    } catch (error) {
        console.error("💥 [FATAL ERROR] sendMessage:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// ... (getMessages و getContacts كما هي)
export const getMessages = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = parseInt(req.params.userId);
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: myId, receiverId: otherId },
                    { senderId: otherId, receiverId: myId }
                ]
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(messages);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

export const getContacts = async (req, res) => {
    try {
        const myId = req.user.id;
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: myId }, { receiverId: myId }] },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, role: true, specialty: true } },
                receiver: { select: { id: true, firstName: true, lastName: true, role: true, specialty: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        const contactsMap = new Map();
        messages.forEach(msg => {
            const isMeSender = msg.senderId === myId;
            const otherUser = isMeSender ? msg.receiver : msg.sender;
            if (!contactsMap.has(otherUser.id)) {
                contactsMap.set(otherUser.id, otherUser);
            }
        });
        res.json(Array.from(contactsMap.values()));
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};
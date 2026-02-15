import prisma from '../config/prisma.js';

// 1. Book a new appointment
export const createAppointment = async (req, res) => {
    try {
        const { doctorId, date, time, reason } = req.body;
        const patientId = req.user.id;

        // 1. Create Appointment
        const newAppointment = await prisma.appointment.create({
            data: {
                patientId: patientId,
                doctorId: doctorId,
                date: new Date(date),
                time: time,
                reason: reason,
                status: 'PENDING'
            },
            include: {
                patient: { select: { firstName: true, lastName: true } }
            }
        });

        // 2. Create Notification for Doctor
        // 🔥 سنضع patientId في relatedId لكي نستطيع العثور على الإشعار لاحقاً وحذفه
        const patientName = `${newAppointment.patient.firstName} ${newAppointment.patient.lastName}`;

        const notification = await prisma.notification.create({
            data: {
                userId: doctorId,
                type: 'appointment',
                relatedId: newAppointment.id, // 🔥 ربطنا الإشعار برقم الموعد
                message: `طلب حجز جديد من: ${patientName} يوم ${date} الساعة ${time}`,
                isRead: false
            }
        });

        // Real-time Trigger
        req.io.to(`user_${doctorId}`).emit("receive_notification", notification);
        req.io.to(`user_${doctorId}`).emit("appointment_updated", newAppointment);

        res.status(201).json(newAppointment);

    } catch (error) {
        console.error("Create Appointment Error:", error);
        res.status(500).json({ message: 'فشل حجز الموعد' });
    }
};

// 2. Get appointments (كما هو)
export const getMyAppointments = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        const whereCondition = role === 'PATIENT'
            ? { patientId: userId }
            : { doctorId: userId };

        const appointments = await prisma.appointment.findMany({
            where: whereCondition,
            include: {
                doctor: role === 'PATIENT' ? {
                    select: { id: true, firstName: true, lastName: true, specialty: true, clinicAddress: true, phone: true }
                } : false,
                patient: role === 'DOCTOR' ? {
                    select: { id: true, firstName: true, lastName: true, phone: true, gender: true }
                } : false
            },
            orderBy: { date: 'desc' }
        });

        const formatted = appointments.map(appt => {
            const otherParty = role === 'PATIENT' ? appt.doctor : appt.patient;
            return {
                id: appt.id,
                appointment_date: appt.date,
                appointment_time: appt.time,
                status: appt.status.toLowerCase(),
                reason: appt.reason,
                doctor_id: appt.doctorId,
                patient_id: appt.patientId,
                first_name: otherParty.firstName,
                last_name: otherParty.lastName,
                specialty: otherParty.specialty,
                clinic_address: otherParty.clinicAddress,
                phone: otherParty.phone,
                gender: otherParty.gender
            };
        });

        res.json(formatted);

    } catch (error) {
        console.error("Get Appointments Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// 3. Update Status (الحل السحري هنا) 🌟
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'confirmed' or 'cancelled'
        const doctorId = req.user.id;

        const prismaStatus = status.toUpperCase();

        // 1. تحديث الموعد
        const updatedAppt = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { status: prismaStatus },
            include: {
                doctor: { select: { firstName: true, lastName: true } },
                patient: { select: { firstName: true, lastName: true } }
            }
        });

        // 2. 🔥 تنظيف الإشعار القديم عند الطبيب
        // نبحث عن الإشعار المرتبط بهذا الموعد ونجعله مقروءاً
        await prisma.notification.updateMany({
            where: {
                userId: doctorId,
                type: 'appointment',
                relatedId: parseInt(id), // نستخدم رقم الموعد الذي حفظناه سابقاً
                isRead: false
            },
            data: { isRead: true }
        });
        req.io.to(`user_${doctorId}`).emit("refresh_notifications");

        // 3. إشعار المريض
        let msg = '';
        if (status === 'confirmed') msg = `✅ تم تأكيد موعدك مع د. ${updatedAppt.doctor.firstName} ${updatedAppt.doctor.lastName}`;
        if (status === 'cancelled') msg = `❌ تم إلغاء موعدك مع د. ${updatedAppt.doctor.firstName} ${updatedAppt.doctor.lastName}`;

        const notification = await prisma.notification.create({
            data: {
                userId: updatedAppt.patientId,
                type: 'appointment',
                message: msg,
                isRead: false
            }
        });

        // 4. 🔥 فتح الشات تلقائياً (الحل لمشكلة التراسل)
        // إذا تم التأكيد، ننشئ رسالة نظام ترحيبية لكي يظهر كل منهما في قائمة الآخر
        if (status === 'confirmed') {
            const welcomeMsg = await prisma.message.create({
                data: {
                    senderId: doctorId,
                    receiverId: updatedAppt.patientId,
                    content: "تم تأكيد الحجز. يمكنكم الآن بدء المحادثة الطبية.",
                    isRead: false
                }
            });
            // إرسال الرسالة عبر السوكيت للطرفين
            req.io.to(`user_${updatedAppt.patientId}`).emit("receive_message", welcomeMsg);
            req.io.to(`user_${doctorId}`).emit("receive_message", welcomeMsg);
        }

        // إرسال الإشعارات عبر السوكيت
        req.io.to(`user_${updatedAppt.patientId}`).emit("receive_notification", notification);
        req.io.to(`user_${updatedAppt.patientId}`).emit("appointment_updated", updatedAppt);

        res.json({ ...updatedAppt, status: status });

    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ message: 'فشل تحديث الحالة' });
    }
};
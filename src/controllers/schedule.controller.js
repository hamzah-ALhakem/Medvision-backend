import prisma from '../config/prisma.js';

// 1. Save or Update Schedule
export const updateSchedule = async (req, res) => {
    try {
        // تأمين تحويل المعرف لرقم
        const doctorId = parseInt(req.user.id); 
        const { schedule } = req.body; 

        if (isNaN(doctorId)) {
            return res.status(400).json({ message: 'Invalid User ID' });
        }

        if (!schedule || !Array.isArray(schedule)) {
            return res.status(400).json({ message: 'بيانات الجدول غير صحيحة' });
        }

        console.log(`Updating schedule for Doctor ID: ${doctorId}, Days: ${schedule.length}`);

        // استخدام Transaction لضمان سلامة البيانات
        await prisma.$transaction(async (tx) => {
            // 1. حذف الجدول القديم بالكامل لهذا الطبيب
            await tx.schedule.deleteMany({
                where: { doctorId: doctorId }
            });

            // 2. تجهيز البيانات الجديدة
            const dataToInsert = schedule.map(item => ({
                doctorId: doctorId,
                dayOfWeek: item.day,
                // ضمان عدم إرسال وقت فارغ، نضع قيمة افتراضية إذا كان فارغاً
                startTime: item.startTime || '09:00',
                endTime: item.endTime || '17:00',
                isActive: item.isActive
            }));

            // 3. إدخال البيانات الجديدة
            if (dataToInsert.length > 0) {
                await tx.schedule.createMany({
                    data: dataToInsert
                });
            }
        });

        console.log("Schedule updated successfully");
        res.json({ message: 'تم تحديث جدول المواعيد بنجاح' });

    } catch (error) {
        // طباعة الخطأ الكامل في التيرمينال لمعرفة السبب
        console.error("❌ Update Schedule Error:", error);
        res.status(500).json({ 
            message: 'فشل تحديث الجدول', 
            error: error.message 
        });
    }
};

// 2. Get My Schedule
export const getMySchedule = async (req, res) => {
    try {
        const doctorId = parseInt(req.user.id);
        const schedules = await prisma.schedule.findMany({
            where: { doctorId: doctorId }
        });

        // تنسيق البيانات للفرونت إند
        const formatted = schedules.map(s => ({
            day: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive
        }));

        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// 3. Get Specific Doctor's Schedule
export const getDoctorSchedule = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const schedules = await prisma.schedule.findMany({
            where: { 
                doctorId: parseInt(doctorId),
                isActive: true 
            }
        });

        const formatted = schedules.map(s => ({
            day_of_week: s.dayOfWeek, // لاحظ: الفرونت إند قد يتوقع هذا الاسم
            day: s.dayOfWeek,         // نضيف هذا أيضاً للاحتياط
            start_time: s.startTime,
            end_time: s.endTime
        }));

        res.json(formatted);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
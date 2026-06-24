import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

// 1. Save or Update Schedule
export const updateSchedule = async (req, res) => {
    try {
        const doctorId = parseInt(req.user.id);
        const { schedule } = req.body;

        if (isNaN(doctorId)) {
            return res.status(400).json({ message: 'Invalid User ID' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.schedule.deleteMany({ where: { doctorId } });

            const dataToInsert = schedule.map(item => ({
                doctorId,
                dayOfWeek: item.day,
                startTime: item.startTime || '09:00',
                endTime: item.endTime || '17:00',
                isActive: item.isActive
            }));

            if (dataToInsert.length > 0) {
                await tx.schedule.createMany({ data: dataToInsert });
            }
        });

        logger.info(`Schedule updated for Doctor ${doctorId}`);
        res.json({ message: '\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u062c\u062f\u0648\u0644 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0628\u0646\u062c\u0627\u062d' });

    } catch (error) {
        logger.error('Update Schedule Error:', error);
        res.status(500).json({ message: '\u0641\u0634\u0644 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062c\u062f\u0648\u0644' });
    }
};

// 2. Get My Schedule
export const getMySchedule = async (req, res) => {
    try {
        const doctorId = parseInt(req.user.id);
        const schedules = await prisma.schedule.findMany({ where: { doctorId } });

        const formatted = schedules.map(s => ({
            day: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive
        }));

        res.json(formatted);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// 3. Get Specific Doctor's Schedule
export const getDoctorSchedule = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const schedules = await prisma.schedule.findMany({
            where: { doctorId: parseInt(doctorId), isActive: true }
        });

        const formatted = schedules.map(s => ({
            day_of_week: s.dayOfWeek,
            day: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime
        }));

        res.json(formatted);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
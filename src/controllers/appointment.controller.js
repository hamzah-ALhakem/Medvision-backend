import * as appointmentService from '../services/appointment.service.js';
import * as notificationService from '../services/notification.service.js';
import prisma from '../config/prisma.js';
import pusher from '../config/pusher.js';

// 1. Book a new appointment (with double-booking prevention)
export const createAppointment = async (req, res) => {
    try {
        const { doctorId, date, time, reason } = req.body;
        const patientId = req.user.id;

        const newAppointment = await appointmentService.createAppointment({
            patientId, doctorId, date, time, reason
        });

        const patientName = `${newAppointment.patient.firstNameAr} ${newAppointment.patient.lastNameAr}`;

        const notification = await notificationService.createNotification({
            userId: doctorId,
            type: 'appointment',
            relatedId: newAppointment.id,
            message: `\u0637\u0644\u0628 \u062d\u062c\u0632 \u062c\u062f\u064a\u062f \u0645\u0646: ${patientName} \u064a\u0648\u0645 ${date} \u0627\u0644\u0633\u0627\u0639\u0629 ${time}`
        });

        pusher.trigger(`user_${doctorId}`, 'receive_notification', notification);
        pusher.trigger(`user_${doctorId}`, 'appointment_updated', newAppointment);

        res.status(201).json(newAppointment);

    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Failed to book appointment' });
    }
};

// 2. Get appointments (with optional pagination)
export const getMyAppointments = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const page = req.query.page ? parseInt(req.query.page) : null;
        const limit = req.query.limit ? parseInt(req.query.limit) : null;

        const result = await appointmentService.getAppointments({ userId, role, page, limit });
        res.json(result);

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// 3. Update Status (ownership verified in service)
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const doctorId = req.user.id;

        const updatedAppt = await appointmentService.updateStatus({
            appointmentId: parseInt(id), doctorId, status
        });

        // Clean up old doctor notification
        await notificationService.markAppointmentNotificationsRead(doctorId, parseInt(id));
        pusher.trigger(`user_${doctorId}`, 'refresh_notifications', {});

        // Notify patient
        let msg = '';
        if (status === 'confirmed') msg = `\u2705 \u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0645\u0648\u0639\u062f\u0643 \u0645\u0639 \u062f. ${updatedAppt.doctor.firstNameAr} ${updatedAppt.doctor.lastNameAr}`;
        if (status === 'cancelled') msg = `\u274c \u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0645\u0648\u0639\u062f\u0643 \u0645\u0639 \u062f. ${updatedAppt.doctor.firstNameAr} ${updatedAppt.doctor.lastNameAr}`;

        const notification = await notificationService.createNotification({
            userId: updatedAppt.patientId,
            type: 'appointment',
            message: msg
        });

        // Auto-open chat on confirmation
        if (status === 'confirmed') {
            const welcomeMsg = await prisma.message.create({
                data: {
                    senderId: doctorId,
                    receiverId: updatedAppt.patientId,
                    content: '\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u062c\u0632. \u064a\u0645\u0643\u0646\u0643\u0645 \u0627\u0644\u0622\u0646 \u0628\u062f\u0621 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629 \u0627\u0644\u0637\u0628\u064a\u0629.',
                    isRead: false
                }
            });
            pusher.trigger(`user_${updatedAppt.patientId}`, 'receive_message', welcomeMsg);
            pusher.trigger(`user_${doctorId}`, 'receive_message', welcomeMsg);
        }

        pusher.trigger(`user_${updatedAppt.patientId}`, 'receive_notification', notification);
        pusher.trigger(`user_${updatedAppt.patientId}`, 'appointment_updated', updatedAppt);

        res.json({ ...updatedAppt, status });

    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Failed to update status' });
    }
};
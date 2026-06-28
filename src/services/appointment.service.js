import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

// Create a new appointment with double-booking prevention
export const createAppointment = async ({ patientId, doctorId, date, time, reason }) => {
    // Double-booking prevention: check for existing appointment at same slot
    const existing = await prisma.appointment.findFirst({
        where: {
            doctorId,
            date: new Date(date),
            time,
            status: { notIn: ['CANCELLED'] }
        }
    });

    if (existing) {
        const error = new Error('This time slot is already booked');
        error.statusCode = 409;
        throw error;
    }

    const newAppointment = await prisma.appointment.create({
        data: {
            patientId,
            doctorId,
            date: new Date(date),
            time,
            reason,
            status: 'PENDING'
        },
        include: {
            patient: { select: { firstName: true, lastName: true } }
        }
    });

    return newAppointment;
};

// Get appointments for a user (role-aware)
export const getAppointments = async ({ userId, role, page, limit }) => {
    const whereCondition = role === 'PATIENT'
        ? { patientId: userId }
        : { doctorId: userId };

    const safePage  = page  && page  > 0 ? page  : null;
    const safeLimit = limit && limit > 0 ? limit : null;
    const skip = safePage && safeLimit ? (safePage - 1) * safeLimit : undefined;
    const take = safeLimit || undefined;

    const [appointments, total] = await prisma.$transaction([
        prisma.appointment.findMany({
            where: whereCondition,
            include: {
                doctor: role === 'PATIENT' ? {
                    select: { id: true, firstName: true, lastName: true, specialty: true, clinicAddress: true, phone: true }
                } : false,
                patient: role === 'DOCTOR' ? {
                    select: { id: true, firstName: true, lastName: true, phone: true, gender: true }
                } : false
            },
            orderBy: { date: 'desc' },
            skip,
            take,
        }),
        prisma.appointment.count({ where: whereCondition })
    ]);

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
            first_name: otherParty?.firstName,
            last_name: otherParty?.lastName,
            specialty: otherParty?.specialty,
            clinic_address: otherParty?.clinicAddress,
            phone: otherParty?.phone,
            gender: otherParty?.gender
        };
    });

    // Backward compatibility: return flat array if no pagination params
    if (!page && !limit) {
        return formatted;
    }

    return {
        data: formatted,
        pagination: { page, limit, total }
    };
};

// Verify ownership and update status
export const updateStatus = async ({ appointmentId, doctorId, status }) => {
    const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, doctorId }
    });

    if (!appointment) {
        const error = new Error('Appointment not found or access denied');
        error.statusCode = 404;
        throw error;
    }

    const prismaStatus = status.toUpperCase();

    const updatedAppt = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: prismaStatus },
        include: {
            doctor: { select: { firstName: true, lastName: true } },
            patient: { select: { firstName: true, lastName: true } }
        }
    });

    return updatedAppt;
};

import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';

const ALLOWED_ROLES = ['PATIENT', 'DOCTOR'];

export const registerUser = async (userData) => {
    const { fullName, email, password, phone, gender, role, licenseNumber, specialty, clinicAddress, schedule } = userData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        const error = new Error('Email already registered');
        error.statusCode = 409;
        throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const nameParts = fullName ? fullName.split(' ') : ['User', ''];
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    const requestedRole = role ? role.toUpperCase() : 'PATIENT';
    const userRole = ALLOWED_ROLES.includes(requestedRole) ? requestedRole : 'PATIENT';
    const status = userRole === 'DOCTOR' ? 'PENDING' : 'ACTIVE';

    const newUser = await prisma.user.create({
        data: {
            firstName, lastName, email,
            password: hashedPassword,
            phone, gender,
            role: userRole,
            accountStatus: status,
            licenseNumber: userRole === 'DOCTOR' ? licenseNumber : null,
            specialty: userRole === 'DOCTOR' ? specialty : null,
            clinicAddress: userRole === 'DOCTOR' ? clinicAddress : null,
            doctorSchedules: (schedule && schedule.length > 0) ? {
                create: schedule.map(s => ({
                    dayOfWeek: s.day,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    isActive: true
                }))
            } : undefined
        }
    });

    return { user: newUser, role: userRole };
};

export const loginUser = async (email, password) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        const error = new Error('Invalid credentials');
        error.statusCode = 400;
        throw error;
    }

    if (user.accountStatus === 'PENDING') {
        const error = new Error('Account is under review');
        error.statusCode = 403;
        throw error;
    }
    if (user.accountStatus === 'REJECTED') {
        const error = new Error('Account has been rejected');
        error.statusCode = 403;
        throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        const error = new Error('Invalid credentials');
        error.statusCode = 400;
        throw error;
    }

    const token = generateToken(user.id, user.role);

    return {
        token,
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role.toLowerCase(),
            specialty: user.specialty
        }
    };
};

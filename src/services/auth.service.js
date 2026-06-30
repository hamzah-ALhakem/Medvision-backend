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

    // SECURITY (SEC-04): Check account lockout before anything else.
    // If locked, return 429 with remaining minutes so the frontend can display it.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
        const error = new Error(
            `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
        );
        error.statusCode = 429;
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
        // SECURITY (SEC-04): Increment failed attempts counter.
        // Lock the account for 15 minutes after 5 consecutive failures.
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_MINUTES = 15;
        const newAttempts = (user.failedLoginAttempts || 0) + 1;

        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: newAttempts,
                lockedUntil: newAttempts >= MAX_ATTEMPTS
                    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
                    : null,
            },
        });

        const error = new Error('Invalid credentials');
        error.statusCode = 400;
        throw error;
    }

    // SECURITY (SEC-04): Reset counter on successful login.
    await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    if (user.isEmailVerified === false) {
        const error = new Error('Please check your inbox and verify your email before logging in.');
        error.statusCode = 403;
        throw error;
    }

    // SECURITY (SEC-05): Pass tokenVersion so the token carries the current version.
    const token = generateToken(user.id, user.role, user.tokenVersion);

    return {
        token,
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role.toLowerCase(),
            specialty: user.specialty,
            image: user.image
        }
    };
};

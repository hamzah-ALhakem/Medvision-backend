import { body, param, validationResult } from 'express-validator';

// Middleware to check validation results
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation Error', 
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })) 
        });
    }
    next();
};

// --- Auth Validations ---
export const registerValidation = [
    body('fullName')
        .trim()
        .isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role')
        .optional()
        .isIn(['patient', 'doctor', 'PATIENT', 'DOCTOR']).withMessage('Role must be either PATIENT or DOCTOR'),
    body('phone')
        .optional()
        .trim(),
    body('gender')
        .optional()
        .isIn(['Male', 'Female']).withMessage('Gender must be Male or Female'),
];

export const loginValidation = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
];

// --- Appointment Validations ---
export const createAppointmentValidation = [
    body('doctorId')
        .isInt({ min: 1 }).withMessage('Valid doctor ID is required'),
    body('date')
        .notEmpty().withMessage('Date is required')
        .isISO8601().withMessage('Date must be a valid date format'),
    body('time')
        .notEmpty().withMessage('Time is required')
        .matches(/^\d{2}:\d{2}/).withMessage('Time must be in HH:MM format'),
];

export const updateStatusValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('Valid appointment ID is required'),
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['confirmed', 'cancelled', 'CONFIRMED', 'CANCELLED']).withMessage('Status must be confirmed or cancelled'),
];

// --- Message Validations ---
export const sendMessageValidation = [
    body('receiverId')
        .isInt({ min: 1 }).withMessage('Valid receiver ID is required'),
    body('content')
        .trim()
        .notEmpty().withMessage('Message content cannot be empty')
        .isLength({ max: 5000 }).withMessage('Message is too long (max 5000 characters)'),
];

// --- User Validations ---
export const updateProfileValidation = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 1 }).withMessage('First name cannot be empty'),
    body('lastName')
        .optional()
        .trim(),
    body('phone')
        .optional()
        .trim(),
    body('specialty')
        .optional()
        .trim(),
];

export const changePasswordValidation = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

// --- Schedule Validations ---
export const updateScheduleValidation = [
    body('schedule')
        .isArray({ min: 1 }).withMessage('Schedule must be a non-empty array'),
    body('schedule.*.day')
        .notEmpty().withMessage('Day is required for each schedule entry'),
    body('schedule.*.startTime')
        .matches(/^\d{2}:\d{2}/).withMessage('Start time must be in HH:MM format'),
    body('schedule.*.endTime')
        .matches(/^\d{2}:\d{2}/).withMessage('End time must be in HH:MM format'),
];

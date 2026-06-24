import express from 'express';
import { createAppointment, getMyAppointments, updateAppointmentStatus } from '../controllers/appointment.controller.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';
import { createAppointmentValidation, updateStatusValidation, validate } from '../middleware/validators.js';

const router = express.Router();

// Create a new booking (patients only)
router.post('/', authenticateToken, createAppointmentValidation, validate, createAppointment);

// Get list of appointments (any authenticated user)
router.get('/', authenticateToken, getMyAppointments);

// Doctor accepts/rejects appointment (doctors only)
router.put('/:id/status', authenticateToken, authorizeRole('DOCTOR'), updateStatusValidation, validate, updateAppointmentStatus);

export default router;

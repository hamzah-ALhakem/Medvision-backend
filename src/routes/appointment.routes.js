import express from 'express';
import { createAppointment, getMyAppointments, updateAppointmentStatus } from '../controllers/appointment.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// 1. Create a new booking (POST /api/appointments)
router.post('/', authenticateToken, createAppointment);

// 2. Get list of appointments (GET /api/appointments)
router.get('/', authenticateToken, getMyAppointments);

// 3. Doctor accepts/rejects appointment (PUT /api/appointments/:id/status)
router.put('/:id/status', authenticateToken, updateAppointmentStatus);

export default router;


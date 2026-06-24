import express from 'express';
import { updateSchedule, getMySchedule, getDoctorSchedule } from '../controllers/schedule.controller.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';
import { updateScheduleValidation, validate } from '../middleware/validators.js';

const router = express.Router();

// Only doctors can update their own schedule
router.post('/', authenticateToken, authorizeRole('DOCTOR'), updateScheduleValidation, validate, updateSchedule);
router.get('/my-schedule', authenticateToken, getMySchedule);
router.get('/:doctorId', getDoctorSchedule);

export default router;
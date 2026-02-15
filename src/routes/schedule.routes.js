import express from 'express';
import { updateSchedule, getMySchedule, getDoctorSchedule } from '../controllers/schedule.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', authenticateToken, updateSchedule);
router.get('/my-schedule', authenticateToken, getMySchedule);
router.get('/:doctorId', getDoctorSchedule);

export default router;
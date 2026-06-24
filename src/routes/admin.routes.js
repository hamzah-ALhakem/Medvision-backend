import express from 'express';
import { 
    getPendingDoctors, getActiveDoctors, 
    approveDoctor, rejectDoctor, deleteUser, getStats 
} from '../controllers/admin.controller.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require ADMIN role
router.use(authenticateToken, authorizeRole('ADMIN'));

router.get('/doctors/pending', getPendingDoctors);
router.get('/doctors/active', getActiveDoctors);
router.put('/doctors/:id/approve', approveDoctor);
router.put('/doctors/:id/reject', rejectDoctor);
router.delete('/users/:id', deleteUser);
router.get('/stats', getStats);

export default router;
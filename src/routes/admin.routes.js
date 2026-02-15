import express from 'express';
import { 
    getPendingDoctors, getActiveDoctors, 
    approveDoctor, rejectDoctor, deleteUser, getStats 
} from '../controllers/admin.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/doctors/pending', authenticateToken, getPendingDoctors);
router.get('/doctors/active', authenticateToken, getActiveDoctors); // ✅ هذا المسار ضروري
router.put('/doctors/:id/approve', authenticateToken, approveDoctor);
router.put('/doctors/:id/reject', authenticateToken, rejectDoctor);
router.delete('/users/:id', authenticateToken, deleteUser); // ✅ مسار الحذف
router.get('/stats', authenticateToken, getStats);

export default router;
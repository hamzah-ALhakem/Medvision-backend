import express from 'express';
import { getDoctors, getProfile, updateProfile, changePassword } from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/doctors', getDoctors); // عام
router.get('/profile', authenticateToken, getProfile); // جلب البيانات
router.put('/profile', authenticateToken, updateProfile); // 🟢 تحديث البيانات (كان ناقصاً)
router.put('/change-password', authenticateToken, changePassword); // 🟢 تحديث كلمة المرور

export default router;
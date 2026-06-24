import express from 'express';
import { getDoctors, getProfile, updateProfile, changePassword } from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { updateProfileValidation, changePasswordValidation, validate } from '../middleware/validators.js';

const router = express.Router();

router.get('/doctors', getDoctors);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfileValidation, validate, updateProfile);
router.put('/change-password', authenticateToken, changePasswordValidation, validate, changePassword);

export default router;
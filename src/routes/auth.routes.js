import express from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { registerValidation, loginValidation, validate } from '../middleware/validators.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);

export default router;
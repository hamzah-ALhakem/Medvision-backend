import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validators.js';
import { getAllLabs, createLab, updateLab, deleteLab } from '../controllers/labController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

const labValidation = [
    body('name').trim().notEmpty().withMessage('Lab name is required'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
];

// Apply authentication to all routes
router.use(authenticateToken);

router.get('/', getAllLabs);

// Admin only routes with validation
router.post('/', authorizeRole('ADMIN'), labValidation, validate, createLab);
router.put('/:id', authorizeRole('ADMIN'), labValidation, validate, updateLab);
router.delete('/:id', authorizeRole('ADMIN'), deleteLab);

export default router;

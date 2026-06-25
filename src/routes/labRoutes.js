import express from 'express';
import { getAllLabs, createLab, updateLab, deleteLab } from '../controllers/labController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, getAllLabs);

// Only admins can modify labs
router.use(authenticateToken);
router.use(authorizeRole('ADMIN'));

router.post('/', createLab);
router.put('/:id', updateLab);
router.delete('/:id', deleteLab);

export default router;

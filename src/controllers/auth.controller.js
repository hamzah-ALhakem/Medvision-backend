import * as authService from '../services/auth.service.js';
import { generateToken } from '../utils/jwt.js';

// --- REGISTER ---
export const register = async (req, res) => {
    try {
        const result = await authService.registerUser(req.body);

        if (result.role === 'DOCTOR') {
            return res.status(201).json({
                message: '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u062d\u0633\u0627\u0628\u0643 \u0628\u0646\u062c\u0627\u062d. \u0633\u064a\u0642\u0648\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0628\u0645\u0631\u0627\u062c\u0639\u0629 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0648\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628 \u0642\u0631\u064a\u0628\u0627\u064b.',
                requireApproval: true
            });
        }

        const { password: _, ...safeUser } = result.user;
        const token = generateToken(result.user.id, result.user.role);
        res.status(201).json({ message: '\u062a\u0645 \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0628\u0646\u062c\u0627\u062d', token, user: safeUser });

    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Server Error' });
    }
};

// --- LOGIN ---
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.loginUser(email, password);
        res.json({ message: '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644', ...result });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ message: error.message || 'Server Error' });
    }
};
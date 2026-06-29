import * as authService from '../services/auth.service.js';
import { generateToken } from '../utils/jwt.js';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

// --- REGISTER ---
export const register = async (req, res) => {
    try {
        const result = await authService.registerUser(req.body);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({
            where: { id: result.user.id },
            data: { verificationToken }
        });

        await sendVerificationEmail(result.user.email, verificationToken);

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

// --- VERIFY EMAIL ---
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await prisma.user.findFirst({
            where: { verificationToken: token }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verificationToken: null
            }
        });

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// --- FORGOT PASSWORD ---
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await prisma.user.findUnique({ where: { email } });
        console.log(`[Forgot Password] Request received for normalized email: "${email}"`);
        console.log(`[Forgot Password] User found in DB: ${!!user}`);

        if (user) {
            const resetPasswordToken = crypto.randomBytes(32).toString('hex');
            const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour from now

            try {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        resetPasswordToken,
                        resetPasswordExpires
                    }
                });
                
                await sendPasswordResetEmail(user.email, resetPasswordToken);
            } catch (innerErr) {
                console.error("Failed to update user or send reset email:", innerErr);
            }
        }

        res.json({ message: 'If that email is in our system, a password reset link has been sent.' });
    } catch (error) {
        console.error("Forgot password controller error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// --- RESET PASSWORD ---
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

// Authenticate JWT Token
// SECURITY (SEC-05): Now async — verifies tokenVersion against DB to
// ensure sessions are invalidated when a user changes their password.
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or Expired Token' });
        }

        // SECURITY (SEC-05): Verify the token's version matches the DB value.
        // If the user changed their password, tokenVersion was incremented,
        // invalidating all previously issued tokens.
        try {
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, role: true, tokenVersion: true }
            });

            if (!user || user.tokenVersion !== decoded.tokenVersion) {
                return res.status(403).json({
                    message: 'Session expired. Please log in again.'
                });
            }

            req.user = decoded;
            next();
        } catch (dbError) {
            return res.status(500).json({ message: 'Authentication error' });
        }
    });
};

// Role-Based Access Control (RBAC)
export const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Forbidden: You do not have permission to perform this action' 
            });
        }
        next();
    };
};

import jwt from 'jsonwebtoken';

export const generateToken = (id, role, tokenVersion = 0) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in .env file');
    }

    // SECURITY (SEC-05): Include tokenVersion in payload.
    // On password change, tokenVersion is incremented in DB,
    // making all previously issued tokens invalid.
    return jwt.sign({ id, role, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};
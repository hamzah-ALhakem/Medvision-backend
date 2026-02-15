import jwt from 'jsonwebtoken';

export const generateToken = (id, role) => {
    // التأكد من وجود المفتاح السري
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined in .env file");
    }

    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d', // صلاحية التوكن 30 يوم
    });
};
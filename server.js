import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import logger from './src/utils/logger.js';

// Import Routes
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import scheduleRoutes from './src/routes/schedule.routes.js';
import messageRoutes from './src/routes/message.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import appointmentRoutes from './src/routes/appointment.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import labRoutes from './src/routes/labRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// HTTP Server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Security & Parsing Middleware
app.use(helmet());
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Make io accessible in controllers
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- WebSocket Authentication ---
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        next();
    } catch (err) {
        next(new Error('Invalid or expired token'));
    }
});

io.on('connection', (socket) => {
    socket.join(`user_${socket.userId}`);
    logger.info(`User ${socket.userId} connected (socket: ${socket.id})`);

    socket.on('disconnect', () => {
        logger.info(`User ${socket.userId} disconnected`);
    });
});

// --- ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/labs', labRoutes);

app.get('/', (req, res) => {
    res.send('MedVision API is Running');
});

// Error Handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

export default app;
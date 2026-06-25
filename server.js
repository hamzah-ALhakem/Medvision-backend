import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
const allowedOrigins = ['http://localhost:5173'];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

// Security & Parsing Middleware
app.use(helmet());
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

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
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

export default app;
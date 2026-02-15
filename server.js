import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http'; // 1. استيراد http
import { Server } from 'socket.io'; // 2. استيراد Socket.io

// Import Routes
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import scheduleRoutes from './src/routes/schedule.routes.js';
import messageRoutes from './src/routes/message.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';
import appointmentRoutes from './src/routes/appointment.routes.js';
import adminRoutes from './src/routes/admin.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 3. إعداد السيرفر و Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // للسماح للفرونت إند بالاتصال من أي مكان
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// 4. جعل io متاحاً في كل الـ Controllers (Global IO)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// 5. إعدادات الاتصال (Socket Logic)
io.on("connection", (socket) => {
    console.log(`⚡ Client Connected: ${socket.id}`);

    // عندما يدخل المستخدم، ينضم لغرفة خاصة به برقم الـ ID
    // هذا يسمح لنا بإرسال إشعارات لشخص محدد فقط
    socket.on("join_user", (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`👤 User joined room: user_${userId}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client Disconnected");
    });
});

// Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
    res.send('MedVision API is Running with Socket.io 🚀');
});

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// ---------------------------------------------------------
// التشغيل (نستخدم server بدلاً من app)
// ---------------------------------------------------------

if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => { // استخدمنا server هنا
        console.log(`🚀 Server running with Socket.io on http://localhost:${PORT}`);
    });
}

export default app;
import prisma from '../config/prisma.js'; // تأكد من المسار
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';

// --- REGISTER ---
export const register = async (req, res) => {
    try {
        const { 
            fullName, email, password, phone, gender, role, 
            licenseNumber, specialty, clinicAddress 
        } = req.body;

        // 1. Check existing
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل' });

        // 2. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Prepare Name
        const nameParts = fullName ? fullName.split(' ') : ['User', ''];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // 4. Role & Status Logic 🟢
        const userRole = role ? role.toUpperCase() : 'PATIENT';
        
        // 🔥 الطبيب يكون PENDING، المريض يكون ACTIVE
        const status = userRole === 'DOCTOR' ? 'PENDING' : 'ACTIVE';

        // 5. Create User (Updated with Schedule) 🟢
        const { schedule } = req.body; // استخراج الجدول من الطلب

        const newUser = await prisma.user.create({
            data: {
                firstName, lastName, email, 
                password: hashedPassword,
                phone, gender, 
                role: userRole,
                accountStatus: status,
                
                licenseNumber: userRole === 'DOCTOR' ? licenseNumber : null,
                specialty: userRole === 'DOCTOR' ? specialty : null,
                clinicAddress: userRole === 'DOCTOR' ? clinicAddress : null,

                // 🔥 إضافة الجدول إذا كان موجوداً
                doctorSchedules: (schedule && schedule.length > 0) ? {
                    create: schedule.map(s => ({
                        dayOfWeek: s.day, // تأكد أن الأسماء مطابقة لما يرسله الفرونت
                        startTime: s.startTime,
                        endTime: s.endTime,
                        isActive: true
                    }))
                } : undefined
            }
        });

        // 6. Response
        // إذا كان طبيباً، لا نعطيه توكن بل رسالة انتظار
        if (userRole === 'DOCTOR') {
            return res.status(201).json({
                message: 'تم تسجيل حسابك بنجاح. سيقوم المسؤول بمراجعة بياناتك وتفعيل الحساب قريباً.',
                requireApproval: true
            });
        }

        const token = generateToken(newUser.id, newUser.role);
        res.status(201).json({ message: 'تم التسجيل بنجاح', token, user: newUser });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: 'حدث خطأ في السيرفر' });
    }
};

// --- LOGIN ---
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });

        // 🟢 التحقق من الحالة قبل فحص الباسورد
        if (user.accountStatus === 'PENDING') {
            return res.status(403).json({ message: 'حسابك قيد المراجعة من قبل الإدارة. يرجى الانتظار.' });
        }
        if (user.accountStatus === 'REJECTED') {
            return res.status(403).json({ message: 'نأسف، تم رفض طلب انضمامك.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });

        const token = generateToken(user.id, user.role);

        res.json({
            message: 'تم تسجيل الدخول',
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role.toLowerCase(),
                specialty: user.specialty
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};
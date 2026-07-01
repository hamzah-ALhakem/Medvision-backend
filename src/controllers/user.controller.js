import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

// 1. Get Doctors (only ACTIVE doctors)
export const getDoctors = async (req, res) => {
    try {
        const doctors = await prisma.user.findMany({
            where: { role: 'DOCTOR', accountStatus: 'ACTIVE' },
            select: {
                id: true, firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true, specialtyEn: true, specialtyAr: true,
                clinicAddress: true, gender: true, phone: true, image: true,
                doctorSchedules: {
                    where: { isActive: true },
                    select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true }
                }
            }
        });

        const formatted = doctors.map(doc => ({
            ...doc,
            schedule: doc.doctorSchedules.map(s => ({
                day_of_week: s.dayOfWeek,
                start_time: s.startTime,
                end_time: s.endTime,
                is_active: s.isActive
            }))
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// 2. Get Profile
export const getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true, email: true,
                phone: true, role: true, gender: true, clinicAddress: true,
                specialtyEn: true, specialtyAr: true, licenseNumber: true, image: true
            }
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// 3. Update Profile (General Info) — SECURITY: exclude password from response
export const updateProfile = async (req, res) => {
    try {
        const { firstNameEn, firstNameAr, lastNameEn, lastNameAr, phone, address, specialtyEn, specialtyAr, image } = req.body;
        
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                firstNameEn,
                firstNameAr,
                lastNameEn,
                lastNameAr,
                phone: phone,
                clinicAddress: address,
                specialtyEn,
                specialtyAr,
                image: image
            },
            select: {
                id: true, firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true, email: true,
                phone: true, role: true, clinicAddress: true, specialtyEn: true, specialtyAr: true, image: true
            }
        });

        res.json({ message: 'تم تحديث البيانات بنجاح', user: updatedUser });
    } catch (error) {
        console.error('Update Error:', error);
        res.status(500).json({ message: 'فشل تحديث البيانات' });
    }
};

// 4. Change Password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                password: hashedPassword,
                tokenVersion: { increment: 1 } // SECURITY (SEC-05): invalidate all existing sessions
            }
        });

        res.json({ message: 'تم تغيير كلمة المرور بنجاح' });

    } catch (error) {
        console.error('Password Error:', error);
        res.status(500).json({ message: 'فشل تغيير كلمة المرور' });
    }
};
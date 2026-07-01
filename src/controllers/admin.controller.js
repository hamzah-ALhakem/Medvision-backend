import prisma from '../config/prisma.js';

// 1. Get Pending Doctors
export const getPendingDoctors = async (req, res) => {
    try {
        const doctors = await prisma.user.findMany({
            where: { role: 'DOCTOR', accountStatus: 'PENDING' },
            select: { id: true, firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true, email: true, phone: true, specialtyEn: true, specialtyAr: true, licenseNumber: true, createdAt: true }
        });
        res.json(doctors);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// 2. Get Active Doctors (مهم جداً) ✅
export const getActiveDoctors = async (req, res) => {
    try {
        const doctors = await prisma.user.findMany({
            where: { role: 'DOCTOR', accountStatus: 'ACTIVE' },
            select: { id: true, firstNameEn: true, firstNameAr: true, lastNameEn: true, lastNameAr: true, email: true, phone: true, specialtyEn: true, specialtyAr: true, licenseNumber: true, createdAt: true }
        });
        res.json(doctors);
    } catch (error) { res.status(500).json({ message: 'Server Error' }); }
};

// 3. Approve Doctor
export const approveDoctor = async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: { accountStatus: 'ACTIVE' }
        });
        res.json({ message: 'Approved' });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
};

// 4. Reject Doctor
export const rejectDoctor = async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: { accountStatus: 'REJECTED' }
        });
        res.json({ message: 'Rejected' });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
};

// 5. Delete User (للحذف النهائي) ✅
export const deleteUser = async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
};

// 6. Stats
export const getStats = async (req, res) => {
    try {
        const [doctors, patients, pending, labs] = await prisma.$transaction([
            prisma.user.count({ where: { role: 'DOCTOR', accountStatus: 'ACTIVE' } }),
            prisma.user.count({ where: { role: 'PATIENT' } }),
            prisma.user.count({ where: { role: 'DOCTOR', accountStatus: 'PENDING' } }),
            prisma.lab.count()
        ]);
        res.json({ doctors, patients, pending, labs });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
};
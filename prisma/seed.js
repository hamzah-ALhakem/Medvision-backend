import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding...');

  // 1. تنظيف قاعدة البيانات
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.schedule.deleteMany();
  // إضافة: تنظيف المعامل إذا وجدت
  // await prisma.lab.deleteMany(); 
  await prisma.user.deleteMany();

  // 2. كلمة مرور موحدة
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  // 3. إنشاء Admin (بصلاحية ACTIVE) ✅
  await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@medvision.com',
      password: hashedPassword,
      role: 'ADMIN',
      accountStatus: 'ACTIVE', // 🟢 مهم جداً للدخول
      phone: '01000000000',
    },
  });

  console.log('👤 Admin created: admin@medvision.com');

  // 4. إنشاء طبيب نشط (للتجربة العامة)
  await prisma.user.create({
    data: {
      firstName: 'علي',
      lastName: 'كمال',
      email: 'ali@doctor.com',
      password: hashedPassword,
      role: 'DOCTOR',
      accountStatus: 'ACTIVE', // 🟢 نشط جاهز للحجز
      specialty: 'باطنة (Internal Medicine)',
      clinicAddress: 'مصر الجديدة، القاهرة',
      phone: '01223344556',
      gender: 'Male',
      doctorSchedules: {
        create: [
          { dayOfWeek: 'Sunday', startTime: '10:00', endTime: '16:00', isActive: true },
          { dayOfWeek: 'Tuesday', startTime: '12:00', endTime: '18:00', isActive: true },
        ]
      }
    },
  });

  // 5. إنشاء طبيب "معلق" (لتجربة لوحة تحكم الأدمن) ⏳
  await prisma.user.create({
    data: {
      firstName: 'منى',
      lastName: 'زكي',
      email: 'mona@doctor.com',
      password: hashedPassword,
      role: 'DOCTOR',
      accountStatus: 'PENDING', // 🟡 معلق (سيظهر في لوحة الأدمن للموافقة)
      specialty: 'أطفال (Pediatrics)',
      clinicAddress: 'مدينة نصر، القاهرة',
      licenseNumber: 'MD-998877',
      phone: '01112223334',
      gender: 'Female',
    },
  });

  console.log('✅ Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
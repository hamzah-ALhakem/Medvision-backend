import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database wipe...');
  
  // Wipe database tables
  // Careful with order due to foreign keys. Delete in reverse order of dependencies.
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.labService.deleteMany();
  await prisma.lab.deleteMany();
  await prisma.user.deleteMany();

  console.log('Database wiped successfully.');

  const passwordHash = await bcrypt.hash('123456789', 10);

  console.log('Seeding Patients...');
  const patientsData = [
    { en: 'Ali', ar: 'علي', lastNameEn: 'Kamel', lastNameAr: 'كامل' },
    { en: 'Ahmed', ar: 'أحمد', lastNameEn: 'Salem', lastNameAr: 'سالم' },
    { en: 'Omar', ar: 'عمر', lastNameEn: 'Fawzy', lastNameAr: 'فوزي' },
    { en: 'Hassan', ar: 'حسن', lastNameEn: 'Nour', lastNameAr: 'نور' },
    { en: 'Fatma', ar: 'فاطمة', lastNameEn: 'Adel', lastNameAr: 'عادل' },
    { en: 'Aisha', ar: 'عائشة', lastNameEn: 'Saad', lastNameAr: 'سعد' },
    { en: 'Layla', ar: 'ليلى', lastNameEn: 'Tarek', lastNameAr: 'طارق' },
    { en: 'Mariam', ar: 'مريم', lastNameEn: 'Mahmoud', lastNameAr: 'محمود' }
  ];

  for (let i = 0; i < patientsData.length; i++) {
    await prisma.user.create({
      data: {
        email: `patient${i + 1}@gmail.com`,
        password: passwordHash,
        role: 'PATIENT',
        firstNameEn: patientsData[i].en,
        firstNameAr: patientsData[i].ar,
        lastNameEn: patientsData[i].lastNameEn,
        lastNameAr: patientsData[i].lastNameAr,
        isEmailVerified: true
      }
    });
  }

  console.log('Seeding Doctors...');
  const doctorsData = [
    { en: 'Youssef', ar: 'يوسف', lastNameEn: 'Hassan', lastNameAr: 'حسن', specEn: 'Oncology', specAr: 'علم الأورام', image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=600' },
    { en: 'Khaled', ar: 'خالد', lastNameEn: 'Mostafa', lastNameAr: 'مصطفى', specEn: 'Surgical Oncology', specAr: 'جراحة الأورام', image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=600' },
    { en: 'Tarek', ar: 'طارق', lastNameEn: 'Zaki', lastNameAr: 'زكي', specEn: 'Radiation Oncology', specAr: 'العلاج الإشعاعي للأورام', image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=600' },
    { en: 'Nabil', ar: 'نبيل', lastNameEn: 'Farouk', lastNameAr: 'فاروق', specEn: 'Breast Surgery', specAr: 'جراحة الثدي' },
    { en: 'Mona', ar: 'منى', lastNameEn: 'Samir', lastNameAr: 'سمير', specEn: 'Oncology', specAr: 'علم الأورام' },
    { en: 'Rania', ar: 'رانيا', lastNameEn: 'Galal', lastNameAr: 'جلال', specEn: 'Surgical Oncology', specAr: 'جراحة الأورام' },
    { en: 'Huda', ar: 'هدى', lastNameEn: 'Tawfiq', lastNameAr: 'توفيق', specEn: 'Radiation Oncology', specAr: 'العلاج الإشعاعي للأورام' },
    { en: 'Salma', ar: 'سلمى', lastNameEn: 'Rashad', lastNameAr: 'رشاد', specEn: 'Breast Surgery', specAr: 'جراحة الثدي' }
  ];

  const allDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  for (let i = 0; i < doctorsData.length; i++) {
    // Generate some varied schedules for each doctor
    const schedules = allDays.map((day, index) => {
      // Make some days inactive just to show variation (e.g. Friday off, or alternate days)
      const isActive = i % 2 === 0 ? index !== 6 : index % 2 === 0;
      return {
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        isActive: isActive
      };
    });

    await prisma.user.create({
      data: {
        email: `doctor${i + 1}@gmail.com`,
        password: passwordHash,
        role: 'DOCTOR',
        firstNameEn: doctorsData[i].en,
        firstNameAr: doctorsData[i].ar,
        lastNameEn: doctorsData[i].lastNameEn,
        lastNameAr: doctorsData[i].lastNameAr,
        specialtyEn: doctorsData[i].specEn,
        specialtyAr: doctorsData[i].specAr,
        image: doctorsData[i].image || null,
        isEmailVerified: true,
        doctorSchedules: {
          create: schedules
        }
      }
    });
  }

  console.log('Seeding Admin...');
  await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      password: passwordHash,
      role: 'ADMIN',
      firstNameEn: 'System',
      firstNameAr: 'النظام',
      lastNameEn: 'Admin',
      lastNameAr: 'المسؤول',
      isEmailVerified: true
    }
  });

  console.log('Seeding Labs...');
  const labsData = [
    { en: 'Alpha Lab', ar: 'معمل ألفا', address: '123 Medical St, City', image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&q=80&w=600' },
    { en: 'Beta Lab', ar: 'معمل بيتا', address: '456 Health Ave, City', image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=600' },
    { en: 'Precision Diagnostics', ar: 'التشخيص الدقيق', address: '789 Care Blvd, City', image: 'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&q=80&w=600' },
    { en: 'Central Lab', ar: 'المعمل المركزي', address: '101 Center Rd, City' },
    { en: 'Hope Lab', ar: 'معمل الأمل', address: '202 Hope Ln, City' },
    { en: 'Care Diagnostics', ar: 'تشخيص الرعاية', address: '303 Cure St, City' },
    { en: 'Nova Lab', ar: 'معمل نوفا', address: '404 Nova Blvd, City' },
    { en: 'Prime Lab', ar: 'معمل برايم', address: '505 Prime Rd, City' }
  ];

  for (let i = 0; i < labsData.length; i++) {
    await prisma.lab.create({
      data: {
        nameEn: labsData[i].en,
        nameAr: labsData[i].ar,
        address: labsData[i].address,
        image: labsData[i].image || null,
        services: {
          create: [
            { nameEn: 'FNA Biopsy', nameAr: 'خزعة بالإبرة الدقيقة', price: 150 },
            { nameEn: 'Mammogram', nameAr: 'تصوير الثدي بالأشعة', price: 200 }
          ]
        }
      }
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
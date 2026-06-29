import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const sourceProfileDir = path.join('C:', 'Users', 'Hamzah', 'Desktop', 'FYP', 'medVision', 'Profiles');
const destUploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(destUploadsDir)) {
    fs.mkdirSync(destUploadsDir, { recursive: true });
}

function copyImage(filename) {
    const src = path.join(sourceProfileDir, filename);
    const dest = path.join(destUploadsDir, filename);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        return '/uploads/' + filename;
    }
    return null;
}

const doctorNames = [
    'أحمد محمود', 'سارة حسن', 'خالد عبدالرحمن', 'منى سعيد', 
    'طارق إبراهيم', 'ياسمين كمال', 'عمر سليمان', 'هدى مصطفى'
];

const patientNames = [
    'فاطمة علي', 'مريم يوسف', 'زينب إبراهيم', 'محمد عبدالله', 
    'محمود حسين', 'نورة جابر', 'أميرة صلاح', 'علي السيد'
];

const labNames = [
    'معمل الفا للأنسجة', 'مختبرات دقيقة', 'معمل الشفاء للتحاليل', 'مختبر البرج الطبي',
    'معمل تكنو لاب', 'مختبرات الأمل', 'معمل النخبة للتحاليل', 'مختبرات ابن سينا'
];

async function seed() {
    console.log('Seeding Database...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // CRITICAL: Delete existing seeded accounts to avoid unique constraint errors
    console.log('Cleaning up existing seed data...');
    const allEmails = [];
    for(let i=1; i<=8; i++) {
        allEmails.push(`doctor${i}@medvision.com`);
        allEmails.push(`patient${i}@medvision.com`);
    }
    await prisma.user.deleteMany({
        where: { email: { in: allEmails } }
    });
    
    await prisma.lab.deleteMany({
        where: { name: { in: labNames } }
    });

    const accounts = [];

    // 1. Doctors
    for (let i = 0; i < 8; i++) {
        const imageFile = i < 3 ? `Doc-${i + 1}.jpg` : null;
        let imageUrl = null;
        if (imageFile) {
            imageUrl = copyImage(imageFile);
        }

        const email = `doctor${i + 1}@medvision.com`;
        
        const doctor = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'DOCTOR',
                firstName: doctorNames[i].split(' ')[0],
                lastName: doctorNames[i].split(' ')[1] || '',
                specialty: 'استشاري أورام الثدي',
                clinicAddress: 'مستشفى الأورام المتخصص',
                licenseNumber: `MD-${1000 + i}`,
                image: imageUrl,
                accountStatus: 'ACTIVE'
            }
        });

        // Generate a default schedule for the doctor
        const days = ['Saturday', 'Sunday', 'Monday'];
        for (const day of days) {
            await prisma.schedule.create({
                data: {
                    doctorId: doctor.id,
                    dayOfWeek: day,
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                }
            });
        }
        
        accounts.push({ type: 'Doctor', name: doctorNames[i], email, password: 'password123' });
    }

    // 2. Patients
    for (let i = 0; i < 8; i++) {
        const email = `patient${i + 1}@medvision.com`;
        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'PATIENT',
                firstName: patientNames[i].split(' ')[0],
                lastName: patientNames[i].split(' ')[1] || '',
                accountStatus: 'ACTIVE'
            }
        });
        
        accounts.push({ type: 'Patient', name: patientNames[i], email, password: 'password123' });
    }

    // 3. Labs
    for (let i = 0; i < 8; i++) {
        const imageFile = i < 3 ? `Lab-${i + 1}.jpg` : null;
        let imageUrl = null;
        if (imageFile) {
            imageUrl = copyImage(imageFile);
        }

        const labName = labNames[i];
        await prisma.lab.create({
            data: {
                name: labName,
                address: 'القاهرة - المركز الرئيسي',
                phone: `0101234567${i}`,
                rating: 4.5 + (i % 5) * 0.1,
                image: imageUrl
            }
        });
        
        accounts.push({ type: 'Laboratory', name: labName, email: 'N/A', password: 'N/A' });
    }

    console.log('Seeding completed.');
    console.log(JSON.stringify(accounts));
}

seed().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});

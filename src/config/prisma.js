import { PrismaClient } from '@prisma/client';

// Singleton pattern: prevents connection exhaustion during hot-reload
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export default prisma;
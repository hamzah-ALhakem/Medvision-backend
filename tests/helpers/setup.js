/**
 * tests/helpers/setup.js
 *
 * Shared test utilities:
 * - Prisma client pointed at the test database
 * - DB cleanup functions (called before/after each test suite)
 * - App import (the Express app without starting the server)
 */

import { PrismaClient } from '@prisma/client';

// Create a dedicated Prisma instance for tests
// It reads DATABASE_URL from .env.test (loaded via the npm test script)
export const prisma = new PrismaClient();

/**
 * Wipes all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach or afterEach inside test files.
 */
export const cleanDatabase = async () => {
  // Order matters — delete child records before parents
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.labService.deleteMany();
  await prisma.lab.deleteMany();
  await prisma.user.deleteMany();
};

/**
 * Disconnect Prisma after all tests in a file finish.
 * Call this in afterAll inside test files.
 */
export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};

/**
 * tests/helpers/factories.js
 *
 * Factory functions to quickly create test data.
 * These insert real rows into the test DB and return the created objects.
 *
 * Usage example in a test file:
 *   import { createPatient, createDoctor, createAppointment } from '../helpers/factories.js';
 *   const patient = await createPatient();
 *   const doctor  = await createDoctor();
 */

import { prisma } from './setup.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../src/utils/jwt.js';

// ─── Default plain-text password used in all factory users ───────────────────
export const DEFAULT_PASSWORD = 'TestPassword123';

// ─── Hashed version (computed once, reused) ──────────────────────────────────
const getHashedPassword = async () => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(DEFAULT_PASSWORD, salt);
};

// ─── Counter to make emails unique across test runs ──────────────────────────
let counter = 0;
const uid = () => `${Date.now()}_${++counter}`;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a PATIENT user in the test DB.
 * Returns the user object + a valid JWT token for that user.
 */
export const createPatient = async (overrides = {}) => {
  const hashedPassword = await getHashedPassword();
  const user = await prisma.user.create({
    data: {
      email: `patient_${uid()}@test.com`,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Patient',
      role: 'PATIENT',
      accountStatus: 'ACTIVE',
      ...overrides,
    },
  });
  const token = generateToken(user.id, user.role);
  return { user, token };
};

/**
 * Creates an ACTIVE DOCTOR user in the test DB.
 * Returns the user object + a valid JWT token.
 */
export const createDoctor = async (overrides = {}) => {
  const hashedPassword = await getHashedPassword();
  const user = await prisma.user.create({
    data: {
      email: `doctor_${uid()}@test.com`,
      password: hashedPassword,
      firstName: 'Dr. Test',
      lastName: 'Doctor',
      role: 'DOCTOR',
      accountStatus: 'ACTIVE',
      specialty: 'General Medicine',
      licenseNumber: `LIC-${uid()}`,
      ...overrides,
    },
  });
  const token = generateToken(user.id, user.role);
  return { user, token };
};

/**
 * Creates a PENDING doctor (waiting for admin approval).
 */
export const createPendingDoctor = async (overrides = {}) => {
  const hashedPassword = await getHashedPassword();
  const user = await prisma.user.create({
    data: {
      email: `pending_doc_${uid()}@test.com`,
      password: hashedPassword,
      firstName: 'Pending',
      lastName: 'Doctor',
      role: 'DOCTOR',
      accountStatus: 'PENDING',
      specialty: 'Cardiology',
      licenseNumber: `LIC-P-${uid()}`,
      ...overrides,
    },
  });
  const token = generateToken(user.id, user.role);
  return { user, token };
};

/**
 * Creates a REJECTED doctor.
 */
export const createRejectedDoctor = async (overrides = {}) => {
  const hashedPassword = await getHashedPassword();
  const user = await prisma.user.create({
    data: {
      email: `rejected_doc_${uid()}@test.com`,
      password: hashedPassword,
      firstName: 'Rejected',
      lastName: 'Doctor',
      role: 'DOCTOR',
      accountStatus: 'REJECTED',
      specialty: 'Neurology',
      licenseNumber: `LIC-R-${uid()}`,
      ...overrides,
    },
  });
  const token = generateToken(user.id, user.role);
  return { user, token };
};

/**
 * Creates an ADMIN user in the test DB.
 */
export const createAdmin = async (overrides = {}) => {
  const hashedPassword = await getHashedPassword();
  const user = await prisma.user.create({
    data: {
      email: `admin_${uid()}@test.com`,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      ...overrides,
    },
  });
  const token = generateToken(user.id, user.role);
  return { user, token };
};

/**
 * Creates a PENDING appointment between a patient and a doctor.
 * @param {number} patientId
 * @param {number} doctorId
 * @param {object} overrides - optional field overrides
 */
export const createAppointment = async (patientId, doctorId, overrides = {}) => {
  return prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      date: new Date('2027-01-15'),   // future date, safe for tests
      time: '10:00',
      reason: 'Routine checkup',
      status: 'PENDING',
      ...overrides,
    },
  });
};

/**
 * Creates a CONFIRMED appointment (needed for messaging tests).
 */
export const createConfirmedAppointment = async (patientId, doctorId, overrides = {}) => {
  return createAppointment(patientId, doctorId, {
    status: 'CONFIRMED',
    ...overrides,
  });
};

/**
 * Creates a lab with optional services.
 */
export const createLab = async (overrides = {}) => {
  return prisma.lab.create({
    data: {
      name: `Test Lab ${uid()}`,
      address: '123 Test Street',
      phone: '01000000000',
      rating: 4.5,
      services: {
        create: [
          { name: 'Blood Test', price: 150.0 },
          { name: 'X-Ray', price: 300.0 },
        ],
      },
      ...overrides,
    },
    include: { services: true },
  });
};

/**
 * Creates a doctor schedule entry.
 */
export const createSchedule = async (doctorId, overrides = {}) => {
  return prisma.schedule.create({
    data: {
      doctorId,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '17:00',
      isActive: true,
      ...overrides,
    },
  });
};

/**
 * Creates a notification for a user.
 */
export const createNotification = async (userId, overrides = {}) => {
  return prisma.notification.create({
    data: {
      userId,
      message: 'Test notification',
      type: 'info',
      isRead: false,
      ...overrides,
    },
  });
};

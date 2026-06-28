/**
 * UNIT TESTS — auth.service.js
 *
 * Tests the registerUser and loginUser business logic
 * against the real test database (medvision_test).
 *
 * Run: npm run test:unit
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { registerUser, loginUser } from '../../src/services/auth.service.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';

// ─── Shared test data ─────────────────────────────────────────────────────────

const validPatient = {
  fullName: 'Ahmed Ali',
  email: 'ahmed.ali@test.com',
  password: 'SecurePass123',
  role: 'patient',
};

const validDoctor = {
  fullName: 'Sara Hassan',
  email: 'sara.hassan@test.com',
  password: 'SecurePass123',
  role: 'doctor',
  specialty: 'Cardiology',
  licenseNumber: 'LIC-12345',
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// registerUser
// ─────────────────────────────────────────────────────────────────────────────

describe('registerUser', () => {

  it('TC-01 | registers a valid PATIENT and returns user + role', async () => {
    const result = await registerUser(validPatient);

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('role', 'PATIENT');
    expect(result.user.email).toBe(validPatient.email);
    expect(result.user.role).toBe('PATIENT');
  });

  it('TC-02 | new PATIENT account status is ACTIVE', async () => {
    const result = await registerUser(validPatient);
    expect(result.user.accountStatus).toBe('ACTIVE');
  });

  it('TC-03 | registers a valid DOCTOR and returns requireApproval info', async () => {
    const result = await registerUser(validDoctor);

    expect(result.role).toBe('DOCTOR');
    expect(result.user.role).toBe('DOCTOR');
  });

  it('TC-04 | new DOCTOR account status is PENDING (awaits admin approval)', async () => {
    const result = await registerUser(validDoctor);
    expect(result.user.accountStatus).toBe('PENDING');
  });

  it('TC-05 | password is hashed — stored value is not plain text', async () => {
    const result = await registerUser(validPatient);
    const storedUser = await prisma.user.findUnique({
      where: { email: validPatient.email },
    });

    expect(storedUser.password).not.toBe(validPatient.password);
    const isHashed = await bcrypt.compare(validPatient.password, storedUser.password);
    expect(isHashed).toBe(true);
  });

  it('TC-06 | duplicate email throws error with statusCode 400', async () => {
    await registerUser(validPatient);

    const error = await registerUser(validPatient).catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Email already registered');
    expect(error.statusCode).toBe(400);
  });

  it('TC-07 | fullName "Ahmed Ali" splits into firstName="Ahmed" lastName="Ali"', async () => {
    const result = await registerUser(validPatient);
    expect(result.user.firstName).toBe('Ahmed');
    expect(result.user.lastName).toBe('Ali');
  });

  it('TC-08 | fullName with single word sets firstName and lastName=""', async () => {
    const result = await registerUser({ ...validPatient, fullName: 'Ahmed', email: 'single@test.com' });
    expect(result.user.firstName).toBe('Ahmed');
    expect(result.user.lastName).toBe('');
  });

  it('TC-09 | fullName with three words joins last two as lastName', async () => {
    const result = await registerUser({ ...validPatient, fullName: 'Ahmed Mohamed Ali', email: 'three@test.com' });
    expect(result.user.firstName).toBe('Ahmed');
    expect(result.user.lastName).toBe('Mohamed Ali');
  });

  it('TC-10 | unknown role defaults to PATIENT', async () => {
    const result = await registerUser({ ...validPatient, role: 'superadmin', email: 'unknown@test.com' });
    expect(result.user.role).toBe('PATIENT');
  });

  it('TC-11 | role is case-insensitive — "PATIENT" and "patient" both work', async () => {
    const upper = await registerUser({ ...validPatient, role: 'PATIENT', email: 'upper@test.com' });
    const lower = await registerUser({ ...validPatient, role: 'patient', email: 'lower@test.com' });
    expect(upper.user.role).toBe('PATIENT');
    expect(lower.user.role).toBe('PATIENT');
  });

  it('TC-12 | DOCTOR gets specialty and licenseNumber stored', async () => {
    const result = await registerUser(validDoctor);
    expect(result.user.specialty).toBe(validDoctor.specialty);
    expect(result.user.licenseNumber).toBe(validDoctor.licenseNumber);
  });

  it('TC-13 | PATIENT does not get specialty or licenseNumber stored', async () => {
    const result = await registerUser({ ...validPatient, specialty: 'Cardiology', licenseNumber: 'LIC-999' });
    expect(result.user.specialty).toBeNull();
    expect(result.user.licenseNumber).toBeNull();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// loginUser
// ─────────────────────────────────────────────────────────────────────────────

describe('loginUser', () => {

  it('TC-14 | valid ACTIVE patient login returns token and user object', async () => {
    await registerUser(validPatient);
    const result = await loginUser(validPatient.email, validPatient.password);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe(validPatient.email);
  });

  it('TC-15 | login returns role in lowercase', async () => {
    await registerUser(validPatient);
    const result = await loginUser(validPatient.email, validPatient.password);
    expect(result.user.role).toBe('patient');
  });

  it('TC-16 | login response NEVER contains the password field', async () => {
    await registerUser(validPatient);
    const result = await loginUser(validPatient.email, validPatient.password);

    expect(result.user).not.toHaveProperty('password');
  });

  it('TC-17 | wrong password throws error with statusCode 400', async () => {
    await registerUser(validPatient);
    const error = await loginUser(validPatient.email, 'WrongPassword!').catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Invalid credentials');
    expect(error.statusCode).toBe(400);
  });

  it('TC-18 | non-existent email throws error with statusCode 400', async () => {
    const error = await loginUser('nobody@test.com', 'SomePassword123').catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Invalid credentials');
    expect(error.statusCode).toBe(400);
  });

  it('TC-19 | PENDING doctor login is blocked with statusCode 403', async () => {
    await registerUser(validDoctor);
    const error = await loginUser(validDoctor.email, validDoctor.password).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Account is under review');
    expect(error.statusCode).toBe(403);
  });

  it('TC-20 | REJECTED doctor login is blocked with statusCode 403', async () => {
    // Register then manually reject
    await registerUser(validDoctor);
    await prisma.user.update({
      where: { email: validDoctor.email },
      data: { accountStatus: 'REJECTED' },
    });

    const error = await loginUser(validDoctor.email, validDoctor.password).catch(e => e);
    expect(error.message).toBe('Account has been rejected');
    expect(error.statusCode).toBe(403);
  });

  it('TC-21 | token is a non-empty string (valid JWT format)', async () => {
    await registerUser(validPatient);
    const result = await loginUser(validPatient.email, validPatient.password);

    expect(typeof result.token).toBe('string');
    expect(result.token.split('.')).toHaveLength(3); // JWT = header.payload.signature
  });

});

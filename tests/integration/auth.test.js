/**
 * INTEGRATION TESTS — /api/auth
 * POST /api/auth/register
 * POST /api/auth/login
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/setup.js';
import { createPatient, createDoctor, createPendingDoctor, createRejectedDoctor } from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {

  it('TC-01 | valid PATIENT → 201 + token + user object', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali',
      email:    'ahmed@test.com',
      password: 'SecurePass123',
      role:     'patient',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    // Register returns the DB role (uppercase PATIENT), login returns lowercase
    expect(res.body.user.role).toBe('PATIENT');
  });

  it('TC-02 | valid PATIENT response does NOT contain password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali',
      email:    'ahmed@test.com',
      password: 'SecurePass123',
      role:     'patient',
    });

    expect(res.body.user).not.toHaveProperty('password');
  });

  it('TC-03 | valid DOCTOR → 201 + requireApproval:true — no token issued', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName:      'Dr Sara Hassan',
      email:         'sara@test.com',
      password:      'SecurePass123',
      role:          'doctor',
      specialty:     'Cardiology',
      licenseNumber: 'LIC-001',
    });

    expect(res.status).toBe(201);
    expect(res.body.requireApproval).toBe(true);
    expect(res.body).not.toHaveProperty('token');
  });

  it('TC-04 | duplicate email → 409 (BUG-002 FIXED)', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'dup@test.com', password: 'SecurePass123',
    });

    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'dup@test.com', password: 'SecurePass123',
    });

    // BUG-002 is now FIXED — returns 409 Conflict
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('message');
  });

  it('TC-05 | missing fullName → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'no-name@test.com', password: 'SecurePass123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation Error');
  });

  it('TC-06 | password less than 8 chars → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'short@test.com', password: '123',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'password')).toBe(true);
  });

  it('TC-07 | invalid email format → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'not-an-email', password: 'SecurePass123',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('TC-08 | invalid role value → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'role@test.com', password: 'SecurePass123', role: 'superadmin',
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(e => e.field === 'role')).toBe(true);
  });

  it('TC-09 | empty body → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {

  it('TC-10 | correct credentials → 200 + token + user (no password)', async () => {
    await createPatient({ email: 'login@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com', password: 'TestPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('TC-11 | wrong password → 400', async () => {
    await createPatient({ email: 'wrongpw@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'wrongpw@test.com', password: 'WrongPassword!',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('TC-12 | non-existent email → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@test.com', password: 'SomePassword123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('TC-13 | PENDING doctor → 403', async () => {
    await createPendingDoctor({ email: 'pending@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'pending@test.com', password: 'TestPassword123',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account is under review');
  });

  it('TC-14 | REJECTED doctor → 403', async () => {
    await createRejectedDoctor({ email: 'rejected@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'rejected@test.com', password: 'TestPassword123',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account has been rejected');
  });

  it('TC-15 | missing email → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/login').send({
      password: 'SecurePass123',
    });

    expect(res.status).toBe(400);
  });

  it('TC-16 | missing password → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'someone@test.com',
    });

    expect(res.status).toBe(400);
  });

  it('TC-17 | returned token is valid JWT format (3 parts)', async () => {
    await createPatient({ email: 'jwt@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'jwt@test.com', password: 'TestPassword123',
    });

    const parts = res.body.token.split('.');
    expect(parts).toHaveLength(3);
  });

});

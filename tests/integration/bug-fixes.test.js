/**
 * PHASE 5 — BUG FIX VERIFICATION TESTS
 *
 * Each test verifies that a specific bug has been fixed by your friend.
 * Run this file AFTER the fixes are applied to confirm they work.
 *
 * Run: npm test -- tests/integration/bug-fixes.test.js
 *
 * Bugs being verified:
 *   BUG-001 — /stats labs count hardcoded 0         (admin.controller.js)
 *   BUG-002 — Duplicate email returns 400 not 409   (auth.service.js)
 *   BUG-003 — Lab creation missing validation → 500 (labRoutes.js)
 *   BUG-004 — Double authenticateToken on labs       (labRoutes.js)
 *   BUG-005 — Negative page number → 500 crash      (appointment.service.js)
 *   BUG-006 — Oversized body returns 500 not 413    (server.js)
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import {
  createAdmin, createPatient, createDoctor,
  createLab, createAppointment,
  createConfirmedAppointment,
} from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─────────────────────────────────────────────────────────────────────────────
// BUG-001 — /stats labs count must reflect real DB value
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-001 FIX — GET /api/admin/stats returns real labs count', () => {

  it('BUG-001-FIX-01 | stats.labs equals 0 when no labs exist', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.labs).toBe(0);
  });

  it('BUG-001-FIX-02 | stats.labs reflects actual lab count in DB', async () => {
    const { token } = await createAdmin();
    // Create 3 labs directly in DB
    await createLab();
    await createLab();
    await createLab();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // BEFORE FIX: res.body.labs === 0 (hardcoded)
    // AFTER FIX:  res.body.labs === 3 (real count)
    expect(res.body.labs).toBe(3); // ← this is the fix verification
    expect(typeof res.body.labs).toBe('number');
  });

  it('BUG-001-FIX-03 | stats.labs updates correctly after adding and removing labs', async () => {
    const { token } = await createAdmin();

    // Create 2 labs
    const lab1 = await createLab();
    await createLab();

    const resAfterCreate = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(resAfterCreate.body.labs).toBe(2);

    // Delete one lab
    await request(app)
      .delete(`/api/labs/${lab1.id}`)
      .set('Authorization', `Bearer ${token}`);

    const resAfterDelete = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(resAfterDelete.body.labs).toBe(1);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-002 — Duplicate email must return 409 not 400
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-002 FIX — Duplicate email registration returns 409 Conflict', () => {

  it('BUG-002-FIX-01 | first registration succeeds with 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'unique@test.com', password: 'SecurePass123',
    });
    expect(res.status).toBe(201);
  });

  it('BUG-002-FIX-02 | duplicate email returns 409 (not 400)', async () => {
    // Register once
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'dup@test.com', password: 'SecurePass123',
    });

    // Register again with same email
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'dup@test.com', password: 'SecurePass123',
    });

    // BEFORE FIX: res.status === 400
    // AFTER FIX:  res.status === 409
    expect(res.status).toBe(409); // ← this is the fix verification
    expect(res.body.message).toMatch(/email already registered/i);
  });

  it('BUG-002-FIX-03 | 409 is distinct from 400 (bad request) — frontend can differentiate', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Test User', email: 'taken@test.com', password: 'SecurePass123',
    });

    const dupRes = await request(app).post('/api/auth/register').send({
      fullName: 'Test User', email: 'taken@test.com', password: 'SecurePass123',
    });

    const validationRes = await request(app).post('/api/auth/register').send({
      fullName: 'T', email: 'valid@test.com', password: 'SecurePass123',
    });

    // Duplicate email = 409
    expect(dupRes.status).toBe(409);
    // Validation error (short name) = 400
    expect(validationRes.status).toBe(400);
    // They must be different so frontend can show different messages
    expect(dupRes.status).not.toBe(validationRes.status);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-003 — Lab creation with missing name must return 400 not 500
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-003 FIX — Lab endpoints validate required fields', () => {

  it('BUG-003-FIX-01 | POST /labs without name returns 400 (not 500)', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'Some Address' }); // missing name

    // BEFORE FIX: res.status === 500 (raw Prisma error)
    // AFTER FIX:  res.status === 400 (validation error)
    expect(res.status).toBe(400); // ← this is the fix verification
    expect(res.status).not.toBe(500);
    expect(res.body).toHaveProperty('message');
  });

  it('BUG-003-FIX-02 | POST /labs without address returns 400', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Lab' }); // missing address

    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('BUG-003-FIX-03 | POST /labs with invalid rating returns 400', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Lab', address: 'Cairo', rating: 99 }); // rating > 5

    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('BUG-003-FIX-04 | PUT /labs/:id without name returns 400', async () => {
    const { token } = await createAdmin();
    const lab = await createLab();

    const res = await request(app)
      .put(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'Updated Address' }); // missing name

    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('BUG-003-FIX-05 | POST /labs with valid data still returns 201', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cairo Lab', address: '10 Tahrir Square' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Cairo Lab');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-004 — authenticateToken must be applied only once on lab routes
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-004 FIX — Lab routes apply authenticateToken exactly once', () => {

  it('BUG-004-FIX-01 | GET /labs still works after restructure (auth applied once)', async () => {
    const { token } = await createPatient();
    await createLab();

    const res = await request(app)
      .get('/api/labs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('BUG-004-FIX-02 | GET /labs without token still returns 401', async () => {
    const res = await request(app).get('/api/labs');
    expect(res.status).toBe(401);
  });

  it('BUG-004-FIX-03 | Admin can still create a lab (ADMIN auth works)', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Valid Lab', address: 'Cairo' });

    expect(res.status).toBe(201);
  });

  it('BUG-004-FIX-04 | Patient still cannot create a lab after restructure', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hack Lab', address: 'Cairo' });

    expect(res.status).toBe(403);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-005 — Negative page number must NOT crash the server
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-005 FIX — Negative pagination values handled gracefully', () => {

  it('BUG-005-FIX-01 | GET /appointments?page=-1 returns 200 or 400 (not 500)', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/appointments?page=-1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    // BEFORE FIX: res.status === 500 (Prisma crash)
    // AFTER FIX:  res.status === 200 (treated as no page param)
    //             OR res.status === 400 (explicit validation)
    expect(res.status).not.toBe(500); // ← this is the fix verification
    expect([200, 400]).toContain(res.status);
  });

  it('BUG-005-FIX-02 | GET /appointments?page=-99&limit=-5 does not crash', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/appointments?page=-99&limit=-5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(500);
    expect([200, 400]).toContain(res.status);
  });

  it('BUG-005-FIX-03 | GET /appointments?page=0 does not crash', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/appointments?page=0&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(500);
  });

  it('BUG-005-FIX-04 | Positive pagination still works correctly', async () => {
    const { user: patient, token } = await createPatient();
    const { user: doctor }         = await createDoctor();

    await createAppointment(patient.id, doctor.id, { time: '09:00' });
    await createAppointment(patient.id, doctor.id, { time: '10:00' });
    await createAppointment(patient.id, doctor.id, { time: '11:00' });

    const res = await request(app)
      .get('/api/appointments?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-006 — Oversized body must return 413 not 500
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-006 FIX — Global error handler forwards HTTP status codes', () => {

  it('BUG-006-FIX-01 | Body over 1mb returns 413 (not 500)', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    // Generate a body just over 1mb
    const oversized = 'x'.repeat(1.1 * 1024 * 1024);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: oversized });

    // BEFORE FIX: res.status === 500 (generic error handler)
    // AFTER FIX:  res.status === 413 (PayloadTooLarge forwarded)
    expect(res.status).toBe(413); // ← this is the fix verification
    expect(res.status).not.toBe(500);
  });

  it('BUG-006-FIX-02 | Error response for 413 includes a message (not raw stack)', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    const oversized = 'x'.repeat(1.1 * 1024 * 1024);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: oversized });

    expect(res.status).toBe(413);
    // Should have a message, not raw Prisma/Node stack trace
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).not.toContain('at '); // no stack trace
  });

  it('BUG-006-FIX-03 | Normal sized body (under 1mb) still works fine', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Normal message content' });

    expect(res.status).toBe(200);
  });

  it('BUG-006-FIX-04 | Other known HTTP errors (400, 404) also forwarded correctly', async () => {
    // Verify the generic error handler still works for non-HTTP errors
    const { token } = await createDoctor();

    // Try to update a non-existent appointment — should return 404
    const res = await request(app)
      .put('/api/appointments/999999/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(500);
  });

});

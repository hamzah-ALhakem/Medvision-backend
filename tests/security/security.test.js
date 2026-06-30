/**
 * SECURITY & EDGE CASE TESTS
 *
 * Tests for authentication bypass, input injection, data isolation,
 * rate limiting behavior, and sensitive data exposure.
 *
 * Run: npm run test:security
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import {
  createPatient, createDoctor, createAdmin,
  createAppointment, createConfirmedAppointment,
  createLab,
} from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─────────────────────────────────────────────────────────────────────────────
// SEC-01 to SEC-04 — Authentication Bypass
// ─────────────────────────────────────────────────────────────────────────────

describe('Authentication Bypass', () => {

  it('SEC-01 | no Authorization header → 401 on protected routes', async () => {
    // Test multiple protected endpoints — all must reject with no token
    const endpoints = [
      { method: 'get',  path: '/api/users/profile' },
      { method: 'get',  path: '/api/appointments' },
      { method: 'get',  path: '/api/notifications' },
      { method: 'get',  path: '/api/messages/contacts' },
      { method: 'get',  path: '/api/labs' },
    ];

    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.path);
      expect(res.status).toBe(401);
    }
  });

  it('SEC-02 | malformed token (not a valid JWT) → 403', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer this.is.not.a.real.token');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid or Expired Token');
  });

  it('SEC-03 | token with tampered payload (role changed to ADMIN) → 403', async () => {
    // Create a real patient token
    const { token: realToken } = await createPatient();

    // Decode the payload without verifying (split the JWT manually)
    const parts = realToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    // Tamper the role
    payload.role = 'ADMIN';

    // Re-encode with the tampered payload but the ORIGINAL signature (now invalid)
    const tamperedToken = [
      parts[0],
      Buffer.from(JSON.stringify(payload)).toString('base64url'),
      parts[2], // original signature — no longer valid for tampered payload
    ].join('.');

    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${tamperedToken}`);

    // Signature is now invalid — must be rejected
    expect(res.status).toBe(403);
  });

  it('SEC-04 | token signed with a different secret → 403', async () => {
    // Sign a token with a DIFFERENT secret (not the real JWT_SECRET)
    const fakeToken = jwt.sign(
      { id: 999, role: 'ADMIN' },
      'totally-wrong-secret-key',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(403);
  });

  it('SEC-05 | Authorization header present but empty value → 401', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
  });

  it('SEC-06 | Authorization header without "Bearer" prefix → 401', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', token); // missing "Bearer " prefix

    expect(res.status).toBe(401);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-07 to SEC-09 — Role Escalation (RBAC)
// ─────────────────────────────────────────────────────────────────────────────

describe('Role Escalation & RBAC', () => {

  it('SEC-07 | patient cannot access any admin endpoint', async () => {
    const { token } = await createPatient();

    const adminEndpoints = [
      { method: 'get',    path: '/api/admin/doctors/pending' },
      { method: 'get',    path: '/api/admin/doctors/active' },
      { method: 'get',    path: '/api/admin/stats' },
      { method: 'put',    path: '/api/admin/doctors/1/approve' },
      { method: 'put',    path: '/api/admin/doctors/1/reject' },
      { method: 'delete', path: '/api/admin/users/1' },
    ];

    for (const ep of adminEndpoints) {
      const res = await request(app)[ep.method](ep.path)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });

  it('SEC-08 | doctor cannot access admin endpoints', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('SEC-09 | patient cannot set a doctor schedule', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [{ day: 'Monday', startTime: '09:00', endTime: '17:00', isActive: true }] });

    expect(res.status).toBe(403);
  });

  it('SEC-10 | patient cannot update appointment status (doctor-only)', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    const appt = await createAppointment(patient.id, doctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('SEC-11 | patient cannot create, update, or delete labs (admin-only)', async () => {
    const { token } = await createPatient();
    const lab       = await createLab();

    const createRes = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fake Lab', address: 'Somewhere' });

    const updateRes = await request(app)
      .put(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });

    const deleteRes = await request(app)
      .delete(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(createRes.status).toBe(403);
    expect(updateRes.status).toBe(403);
    expect(deleteRes.status).toBe(403);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-12 to SEC-15 — Data Isolation (users can only access their own data)
// ─────────────────────────────────────────────────────────────────────────────

describe('Data Isolation', () => {

  it('SEC-12 | patient cannot see another patient\'s appointments', async () => {
    const { user: patient1, token: token1 } = await createPatient();
    const { user: patient2 }                = await createPatient();
    const { user: doctor }                  = await createDoctor();

    // patient2 books 2 appointments
    await createAppointment(patient2.id, doctor.id, { time: '09:00' });
    await createAppointment(patient2.id, doctor.id, { time: '10:00' });

    // patient1 books 1 appointment
    await createAppointment(patient1.id, doctor.id, { time: '11:00' });

    // patient1 requests their appointments
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token1}`);

    const body = Array.isArray(res.body) ? res.body : res.body.data;

    // patient1 should only see their 1 appointment, not patient2's 2
    expect(body.length).toBe(1);
    body.forEach(a => expect(a.patient_id).toBe(patient1.id));
  });

  it('SEC-13 | doctor updating another doctor\'s appointment is blocked', async () => {
    const { user: patient }        = await createPatient();
    const { user: ownerDoctor }    = await createDoctor();
    const { token: attackerToken } = await createDoctor();

    const appt = await createAppointment(patient.id, ownerDoctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ status: 'confirmed' });

    // Must be blocked — 404 means "not found for this doctor"
    expect(res.status).toBe(404);

    // Verify the appointment is still PENDING in DB
    const unchanged = await prisma.appointment.findUnique({ where: { id: appt.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  it('SEC-14 | user cannot mark another user\'s notification as read', async () => {
    const { user: user1 }   = await createPatient();
    const { token: token2 } = await createPatient();

    // Create a notification for user1
    const notif = await prisma.notification.create({
      data: { userId: user1.id, message: 'Private', type: 'info', isRead: false },
    });

    // user2 tries to mark it as read
    const res = await request(app)
      .put(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);

    // Confirm it's still unread
    const unchanged = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(unchanged.isRead).toBe(false);
  });

  it('SEC-15 | patient cannot send a message without a confirmed appointment', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    // Deliberately do NOT create any appointment

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Unsolicited message' });

    expect(res.status).toBe(403);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-16 to SEC-20 — Sensitive Data Exposure
// ─────────────────────────────────────────────────────────────────────────────

describe('Sensitive Data Exposure', () => {

  it('SEC-16 | password never returned from POST /auth/register', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Test User', email: 'nopw@test.com', password: 'SecurePass123',
    });

    expect(res.body).not.toHaveProperty('password');
    if (res.body.user) {
      expect(res.body.user).not.toHaveProperty('password');
    }
  });

  it('SEC-17 | password never returned from POST /auth/login', async () => {
    await createPatient({ email: 'nopwlogin@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'nopwlogin@test.com', password: 'TestPassword123',
    });

    expect(res.body).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('SEC-18 | password never returned from GET /users/profile', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).not.toHaveProperty('password');
  });

  it('SEC-19 | password never returned from PUT /users/profile', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated' });

    expect(res.body).not.toHaveProperty('password');
    if (res.body.user) {
      expect(res.body.user).not.toHaveProperty('password');
    }
  });

  it('SEC-20 | password never returned from GET /users/doctors', async () => {
    await createDoctor();

    const res = await request(app).get('/api/users/doctors');

    res.body.forEach(doctor => {
      expect(doctor).not.toHaveProperty('password');
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-21 to SEC-25 — Input Validation & Injection
// ─────────────────────────────────────────────────────────────────────────────

describe('Input Validation & Injection', () => {

  it('SEC-21 | SQL injection attempt in email field is treated as literal string', async () => {
    // Prisma uses parameterized queries — SQL injection is not possible
    // This test verifies no crash or unexpected behavior occurs
    const res = await request(app).post('/api/auth/login').send({
      email: "' OR 1=1 --",
      password: 'anything',
    });

    // Should return a normal validation/auth error, NOT a 500 server crash
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('SEC-22 | XSS payload in fullName is stored safely as plain text (no execution)', async () => {
    const xssPayload = '<script>alert("xss")</script>';

    const res = await request(app).post('/api/auth/register').send({
      fullName: xssPayload,
      email:    'xss@test.com',
      password: 'SecurePass123',
    });

    // Should register successfully (API stores data, doesn't execute HTML)
    expect(res.status).toBe(201);

    // Verify stored value is the raw string, not something sanitized or broken
    const stored = await prisma.user.findUnique({ where: { email: 'xss@test.com' } });
    expect(stored.firstName).toBe('<script>alert("xss")</script>');
  });

  it('SEC-23 | very long string in message content (over limit) → 400', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'a'.repeat(5001) });

    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('SEC-24 | BUG-005 FIXED: negative page number handled gracefully (no 500)', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/appointments?page=-1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    // BUG-005 FIXED: negative page no longer crashes the server
    expect(res.status).not.toBe(500);
    expect([200, 400]).toContain(res.status);
  });

  it('SEC-25 | non-integer doctorId in appointment booking → 400 (not 500)', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: 'abc', date: '2027-01-15', time: '10:00' });

    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('SEC-26 | BUG-006 FIXED: oversized JSON body returns 413 (not 500)', async () => {
    const { token } = await createPatient();

    const oversizedContent = 'x'.repeat(1.1 * 1024 * 1024);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiverId: 1, content: oversizedContent });

    // BUG-006 FIXED: global error handler now forwards err.status correctly
    expect(res.status).toBe(413);
    expect(res.status).not.toBe(500);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-27 — Rate Limiting (confirm it works in normal mode)
// ─────────────────────────────────────────────────────────────────────────────

describe('Rate Limiting', () => {

  it('SEC-27 | rate limiter is disabled in test environment (NODE_ENV=test)', async () => {
    // Make 15 rapid login requests — none should return 429 in test mode
    const responses = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/auth/login').send({
        email: `nonexistent${i}@test.com`, password: 'anything',
      });
      responses.push(res.status);
    }

    // All should return 400 (wrong credentials), not 429 (rate limited)
    const rateLimited = responses.filter(s => s === 429);
    expect(rateLimited.length).toBe(0);
  });

});

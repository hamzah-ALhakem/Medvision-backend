/**
 * INTEGRATION TESTS — /api/admin
 * GET    /api/admin/doctors/pending
 * GET    /api/admin/doctors/active
 * PUT    /api/admin/doctors/:id/approve
 * PUT    /api/admin/doctors/:id/reject
 * DELETE /api/admin/users/:id
 * GET    /api/admin/stats
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import {
  createAdmin, createPatient, createDoctor,
  createPendingDoctor, createLab,
} from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─── GET /api/admin/doctors/pending ──────────────────────────────────────────

describe('GET /api/admin/doctors/pending', () => {

  it('TC-01 | admin gets list of pending doctors', async () => {
    const { token } = await createAdmin();
    await createPendingDoctor();
    await createPendingDoctor();

    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('TC-02 | patient token → 403 forbidden', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('TC-03 | doctor token → 403 forbidden', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('TC-04 | no token → 401', async () => {
    const res = await request(app).get('/api/admin/doctors/pending');
    expect(res.status).toBe(401);
  });

  it('TC-05 | returns empty array when no pending doctors', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

});

// ─── GET /api/admin/doctors/active ───────────────────────────────────────────

describe('GET /api/admin/doctors/active', () => {

  it('TC-06 | returns only ACTIVE doctors', async () => {
    const { token } = await createAdmin();
    await createDoctor();       // ACTIVE
    await createDoctor();       // ACTIVE
    await createPendingDoctor(); // should NOT appear

    const res = await request(app)
      .get('/api/admin/doctors/active')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('TC-07 | non-admin → 403', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/admin/doctors/active')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

});

// ─── PUT /api/admin/doctors/:id/approve ──────────────────────────────────────

describe('PUT /api/admin/doctors/:id/approve', () => {

  it('TC-08 | admin approves pending doctor → accountStatus becomes ACTIVE', async () => {
    const { token }      = await createAdmin();
    const { user: doc }  = await createPendingDoctor();

    const res = await request(app)
      .put(`/api/admin/doctors/${doc.id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: doc.id } });
    expect(updated.accountStatus).toBe('ACTIVE');
  });

  it('TC-09 | after approval doctor can login', async () => {
    const { token: adminTok }    = await createAdmin();
    const { user: doc }          = await createPendingDoctor({ email: 'approveme@test.com' });

    await request(app)
      .put(`/api/admin/doctors/${doc.id}/approve`)
      .set('Authorization', `Bearer ${adminTok}`);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'approveme@test.com', password: 'TestPassword123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('TC-10 | non-admin → 403', async () => {
    const { token }     = await createPatient();
    const { user: doc } = await createPendingDoctor();

    const res = await request(app)
      .put(`/api/admin/doctors/${doc.id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

});

// ─── PUT /api/admin/doctors/:id/reject ───────────────────────────────────────

describe('PUT /api/admin/doctors/:id/reject', () => {

  it('TC-11 | admin rejects doctor → accountStatus becomes REJECTED', async () => {
    const { token }      = await createAdmin();
    const { user: doc }  = await createPendingDoctor();

    const res = await request(app)
      .put(`/api/admin/doctors/${doc.id}/reject`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: doc.id } });
    expect(updated.accountStatus).toBe('REJECTED');
  });

  it('TC-12 | rejected doctor cannot login → 403', async () => {
    const { token: adminTok }   = await createAdmin();
    const { user: doc }         = await createPendingDoctor({ email: 'rejectme@test.com' });

    await request(app)
      .put(`/api/admin/doctors/${doc.id}/reject`)
      .set('Authorization', `Bearer ${adminTok}`);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'rejectme@test.com', password: 'TestPassword123',
    });

    expect(loginRes.status).toBe(403);
  });

});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {

  it('TC-13 | admin deletes a user — user no longer in DB', async () => {
    const { token }         = await createAdmin();
    const { user: patient } = await createPatient();

    const res = await request(app)
      .delete(`/api/admin/users/${patient.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const deleted = await prisma.user.findUnique({ where: { id: patient.id } });
    expect(deleted).toBeNull();
  });

  it('TC-14 | non-admin → 403', async () => {
    const { token }         = await createPatient();
    const { user: patient } = await createPatient();

    const res = await request(app)
      .delete(`/api/admin/users/${patient.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('TC-15 | no token → 401', async () => {
    const res = await request(app).delete('/api/admin/users/1');
    expect(res.status).toBe(401);
  });

});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {

  it('TC-16 | returns numeric counts for doctors, patients, pending', async () => {
    const { token } = await createAdmin();
    await createDoctor();
    await createDoctor();
    await createPatient();
    await createPendingDoctor();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.doctors).toBe('number');
    expect(typeof res.body.patients).toBe('number');
    expect(typeof res.body.pending).toBe('number');
    expect(res.body.doctors).toBe(2);
    expect(res.body.patients).toBe(1);
    expect(res.body.pending).toBe(1);
  });

  it('TC-17 | BUG-001: labs count is hardcoded 0 regardless of real lab count', async () => {
    const { token } = await createAdmin();
    // Create real labs in DB
    await createLab();
    await createLab();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    // This test DOCUMENTS the bug — labs should be 2, but returns 0
    // When BUG-001 is fixed, change this to: expect(res.body.labs).toBe(2)
    expect(res.body.labs).toBe(0); // ← BUG-001: hardcoded, not queried from DB
  });

  it('TC-18 | non-admin → 403', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

});

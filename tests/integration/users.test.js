/**
 * INTEGRATION TESTS — /api/users
 * GET    /api/users/doctors
 * GET    /api/users/profile
 * PUT    /api/users/profile
 * PUT    /api/users/change-password
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/setup.js';
import {
  createPatient, createDoctor,
  createPendingDoctor, createRejectedDoctor,
} from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─── GET /api/users/doctors ───────────────────────────────────────────────────

describe('GET /api/users/doctors', () => {

  it('TC-01 | returns 200 with array of ACTIVE doctors only', async () => {
    await createDoctor();
    await createDoctor();
    await createPendingDoctor();   // should not appear
    await createRejectedDoctor();  // should not appear

    const res = await request(app).get('/api/users/doctors');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('TC-02 | PENDING and REJECTED doctors are excluded', async () => {
    await createPendingDoctor();
    await createRejectedDoctor();

    const res = await request(app).get('/api/users/doctors');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('TC-03 | each doctor object has a schedule array', async () => {
    await createDoctor();

    const res = await request(app).get('/api/users/doctors');

    expect(res.body[0]).toHaveProperty('schedule');
    expect(Array.isArray(res.body[0].schedule)).toBe(true);
  });

  it('TC-04 | doctor objects do NOT contain password field', async () => {
    await createDoctor();

    const res = await request(app).get('/api/users/doctors');

    expect(res.body[0]).not.toHaveProperty('password');
  });

  it('TC-05 | works without authentication (public endpoint)', async () => {
    const res = await request(app).get('/api/users/doctors');
    // No auth header — should still return 200
    expect(res.status).toBe(200);
  });

});

// ─── GET /api/users/profile ───────────────────────────────────────────────────

describe('GET /api/users/profile', () => {

  it('TC-06 | authenticated user gets their profile', async () => {
    const { token } = await createPatient({ email: 'profile@test.com' });

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'profile@test.com');
  });

  it('TC-07 | profile response does NOT contain password', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body).not.toHaveProperty('password');
  });

  it('TC-08 | no token → 401', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('TC-09 | malformed token → 403', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer this.is.fake');

    expect(res.status).toBe(403);
  });

});

// ─── PUT /api/users/profile ───────────────────────────────────────────────────

describe('PUT /api/users/profile', () => {

  it('TC-10 | updates firstName, lastName, phone successfully', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated', lastName: 'Name', phone: '01099999999' });

    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Updated');
    expect(res.body.user.lastName).toBe('Name');
  });

  it('TC-11 | updated profile response does NOT contain password', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Test' });

    expect(res.body.user).not.toHaveProperty('password');
  });

  it('TC-12 | empty firstName → 400 validation error', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '' });

    expect(res.status).toBe(400);
  });

  it('TC-13 | no token → 401', async () => {
    const res = await request(app).put('/api/users/profile').send({ firstName: 'Test' });
    expect(res.status).toBe(401);
  });

});

// ─── PUT /api/users/change-password ──────────────────────────────────────────

describe('PUT /api/users/change-password', () => {

  it('TC-14 | correct current password → 200 success', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'TestPassword123', newPassword: 'NewSecure456' });

    expect(res.status).toBe(200);
  });

  it('TC-15 | after password change, can login with new password', async () => {
    const { token, user } = await createPatient({ email: 'changepw@test.com' });

    await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'TestPassword123', newPassword: 'NewSecure456' });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'changepw@test.com', password: 'NewSecure456',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('TC-16 | wrong current password → 400', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongOldPassword', newPassword: 'NewSecure456' });

    expect(res.status).toBe(400);
  });

  it('TC-17 | new password less than 8 chars → 400 validation error', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'TestPassword123', newPassword: '123' });

    expect(res.status).toBe(400);
  });

  it('TC-18 | missing currentPassword → 400', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'NewSecure456' });

    expect(res.status).toBe(400);
  });

  it('TC-19 | no token → 401', async () => {
    const res = await request(app)
      .put('/api/users/change-password')
      .send({ currentPassword: 'TestPassword123', newPassword: 'NewSecure456' });

    expect(res.status).toBe(401);
  });

});

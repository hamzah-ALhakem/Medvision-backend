/**
 * INTEGRATION TESTS — /api/schedule
 * POST   /api/schedule
 * GET    /api/schedule/my-schedule
 * GET    /api/schedule/:doctorId
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import { createDoctor, createPatient, createSchedule } from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

const VALID_SCHEDULE = [
  { day: 'Monday',    startTime: '09:00', endTime: '17:00', isActive: true },
  { day: 'Wednesday', startTime: '10:00', endTime: '15:00', isActive: true },
];

// ─── POST /api/schedule ───────────────────────────────────────────────────────

describe('POST /api/schedule', () => {

  it('TC-01 | doctor sets a valid schedule → 200 success', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: VALID_SCHEDULE });

    expect(res.status).toBe(200);
  });

  it('TC-02 | schedule is fully replaced on second POST (delete + recreate)', async () => {
    const { user: doctor, token } = await createDoctor();

    // First save
    await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: VALID_SCHEDULE });

    // Second save with different data
    await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [{ day: 'Friday', startTime: '08:00', endTime: '14:00', isActive: true }] });

    const saved = await prisma.schedule.findMany({ where: { doctorId: doctor.id } });

    // Should only have 1 entry (Friday), not 3 (old 2 + new 1)
    expect(saved).toHaveLength(1);
    expect(saved[0].dayOfWeek).toBe('Friday');
  });

  it('TC-03 | patient tries to set schedule → 403 forbidden', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: VALID_SCHEDULE });

    expect(res.status).toBe(403);
  });

  it('TC-04 | empty schedule array → 400 validation error', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [] });

    expect(res.status).toBe(400);
  });

  it('TC-05 | missing day in entry → 400 validation error', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [{ startTime: '09:00', endTime: '17:00' }] }); // no day

    expect(res.status).toBe(400);
  });

  it('TC-06 | invalid time format → 400 validation error', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ schedule: [{ day: 'Monday', startTime: '9am', endTime: '5pm' }] });

    expect(res.status).toBe(400);
  });

  it('TC-07 | no token → 401', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .send({ schedule: VALID_SCHEDULE });

    expect(res.status).toBe(401);
  });

});

// ─── GET /api/schedule/my-schedule ───────────────────────────────────────────

describe('GET /api/schedule/my-schedule', () => {

  it('TC-08 | doctor gets their own schedule', async () => {
    const { user: doctor, token } = await createDoctor();
    await createSchedule(doctor.id, { dayOfWeek: 'Tuesday' });
    await createSchedule(doctor.id, { dayOfWeek: 'Thursday' });

    const res = await request(app)
      .get('/api/schedule/my-schedule')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('TC-09 | returns empty array when doctor has no schedule set', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .get('/api/schedule/my-schedule')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('TC-10 | each schedule entry has day, startTime, endTime, isActive', async () => {
    const { user: doctor, token } = await createDoctor();
    await createSchedule(doctor.id);

    const res = await request(app)
      .get('/api/schedule/my-schedule')
      .set('Authorization', `Bearer ${token}`);

    const entry = res.body[0];
    expect(entry).toHaveProperty('day');
    expect(entry).toHaveProperty('startTime');
    expect(entry).toHaveProperty('endTime');
    expect(entry).toHaveProperty('isActive');
  });

  it('TC-11 | no token → 401', async () => {
    const res = await request(app).get('/api/schedule/my-schedule');
    expect(res.status).toBe(401);
  });

});

// ─── GET /api/schedule/:doctorId ─────────────────────────────────────────────

describe('GET /api/schedule/:doctorId', () => {

  it('TC-12 | public endpoint returns active schedule for a doctor', async () => {
    const { user: doctor } = await createDoctor();
    await createSchedule(doctor.id, { dayOfWeek: 'Monday', isActive: true });
    await createSchedule(doctor.id, { dayOfWeek: 'Tuesday', isActive: false }); // inactive

    const res = await request(app).get(`/api/schedule/${doctor.id}`);

    expect(res.status).toBe(200);
    // Only active schedules returned
    expect(res.body).toHaveLength(1);
    expect(res.body[0].day_of_week).toBe('Monday');
  });

  it('TC-13 | doctor with no schedule returns empty array', async () => {
    const { user: doctor } = await createDoctor();

    const res = await request(app).get(`/api/schedule/${doctor.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('TC-14 | works without authentication (public endpoint)', async () => {
    const { user: doctor } = await createDoctor();

    const res = await request(app).get(`/api/schedule/${doctor.id}`);
    // No Authorization header needed
    expect(res.status).toBe(200);
  });

});

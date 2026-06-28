/**
 * INTEGRATION TESTS — /api/appointments
 * POST   /api/appointments
 * GET    /api/appointments
 * PUT    /api/appointments/:id/status
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import {
  createPatient, createDoctor,
  createAppointment, createConfirmedAppointment,
} from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

const FUTURE_DATE = '2027-06-15';
const SLOT_TIME   = '10:00';

// ─── POST /api/appointments ───────────────────────────────────────────────────

describe('POST /api/appointments', () => {

  it('TC-01 | patient books valid slot → 201 with status PENDING', async () => {
    const { token: patientToken } = await createPatient();
    const { user: doctor }        = await createDoctor();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME, reason: 'Checkup' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.doctorId).toBe(doctor.id);
  });

  it('TC-02 | double-booking same slot → 409 conflict', async () => {
    const { token: patient1Token } = await createPatient();
    const { token: patient2Token } = await createPatient();
    const { user: doctor }         = await createDoctor();

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({ doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This time slot is already booked');
  });

  it('TC-03 | cancelled slot can be rebooked → 201', async () => {
    const { user: patient1, token: token1 } = await createPatient();
    const { token: token2 }                 = await createPatient();
    const { user: doctor, token: dToken }   = await createDoctor();

    // Book → then cancel via status update
    const bookRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token1}`)
      .send({ doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    await request(app)
      .put(`/api/appointments/${bookRes.body.id}/status`)
      .set('Authorization', `Bearer ${dToken}`)
      .send({ status: 'cancelled' });

    // Second patient books the now-free slot
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token2}`)
      .send({ doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    expect(res.status).toBe(201);
  });

  it('TC-04 | missing date → 400 validation error', async () => {
    const { token } = await createPatient();
    const { user: doctor } = await createDoctor();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: doctor.id, time: SLOT_TIME });

    expect(res.status).toBe(400);
  });

  it('TC-05 | missing time → 400 validation error', async () => {
    const { token } = await createPatient();
    const { user: doctor } = await createDoctor();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: doctor.id, date: FUTURE_DATE });

    expect(res.status).toBe(400);
  });

  it('TC-06 | invalid doctorId (0) → 400 validation error', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: 0, date: FUTURE_DATE, time: SLOT_TIME });

    expect(res.status).toBe(400);
  });

  it('TC-07 | invalid date format → 400 validation error', async () => {
    const { token } = await createPatient();
    const { user: doctor } = await createDoctor();

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: doctor.id, date: 'not-a-date', time: SLOT_TIME });

    expect(res.status).toBe(400);
  });

  it('TC-08 | no token → 401', async () => {
    const { user: doctor } = await createDoctor();

    const res = await request(app)
      .post('/api/appointments')
      .send({ doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    expect(res.status).toBe(401);
  });

});

// ─── GET /api/appointments ────────────────────────────────────────────────────

describe('GET /api/appointments', () => {

  it('TC-09 | patient sees only their own appointments', async () => {
    const { user: patient1, token: token1 } = await createPatient();
    const { user: patient2 }                = await createPatient();
    const { user: doctor }                  = await createDoctor();

    await createAppointment(patient1.id, doctor.id, { time: '09:00' });
    await createAppointment(patient1.id, doctor.id, { time: '10:00' });
    await createAppointment(patient2.id, doctor.id, { time: '11:00' });

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    // All returned appointments belong to patient1
    const body = Array.isArray(res.body) ? res.body : res.body.data;
    expect(body.length).toBe(2);
    body.forEach(a => expect(a.patient_id).toBe(patient1.id));
  });

  it('TC-10 | doctor sees only their own appointments', async () => {
    const { user: patient }           = await createPatient();
    const { user: doctor1, token: t1} = await createDoctor();
    const { user: doctor2 }           = await createDoctor();

    await createAppointment(patient.id, doctor1.id, { time: '09:00' });
    await createAppointment(patient.id, doctor2.id, { time: '10:00' });

    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${t1}`);

    expect(res.status).toBe(200);
    const body = Array.isArray(res.body) ? res.body : res.body.data;
    expect(body.length).toBe(1);
    expect(body[0].doctor_id).toBe(doctor1.id);
  });

  it('TC-11 | pagination returns { data, pagination } structure', async () => {
    const { user: patient, token } = await createPatient();
    const { user: doctor }         = await createDoctor();

    await createAppointment(patient.id, doctor.id, { time: '08:00' });
    await createAppointment(patient.id, doctor.id, { time: '09:00' });
    await createAppointment(patient.id, doctor.id, { time: '10:00' });

    const res = await request(app)
      .get('/api/appointments?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
  });

  it('TC-12 | no token → 401', async () => {
    const res = await request(app).get('/api/appointments');
    expect(res.status).toBe(401);
  });

});

// ─── PUT /api/appointments/:id/status ────────────────────────────────────────

describe('PUT /api/appointments/:id/status', () => {

  it('TC-13 | doctor confirms own appointment → 200 + confirmed status', async () => {
    const { user: patient }        = await createPatient();
    const { user: doctor, token }  = await createDoctor();
    const appt = await createAppointment(patient.id, doctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.status.toLowerCase()).toBe('confirmed');
  });

  it('TC-14 | doctor cancels own appointment → 200 + cancelled status', async () => {
    const { user: patient }        = await createPatient();
    const { user: doctor, token }  = await createDoctor();
    const appt = await createAppointment(patient.id, doctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.status.toLowerCase()).toBe('cancelled');
  });

  it('TC-15 | doctor cannot update another doctor\'s appointment → 404', async () => {
    const { user: patient }         = await createPatient();
    const { user: ownerDoctor }     = await createDoctor();
    const { token: otherDoctorTok } = await createDoctor();
    const appt = await createAppointment(patient.id, ownerDoctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${otherDoctorTok}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(404);
  });

  it('TC-16 | patient tries to update status → 403 forbidden', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    const appt = await createAppointment(patient.id, doctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('TC-17 | invalid status value → 400 validation error', async () => {
    const { user: patient }       = await createPatient();
    const { user: doctor, token } = await createDoctor();
    const appt = await createAppointment(patient.id, doctor.id);

    const res = await request(app)
      .put(`/api/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' }); // not a valid status

    expect(res.status).toBe(400);
  });

  it('TC-18 | no token → 401', async () => {
    const res = await request(app)
      .put('/api/appointments/1/status')
      .send({ status: 'confirmed' });

    expect(res.status).toBe(401);
  });

});

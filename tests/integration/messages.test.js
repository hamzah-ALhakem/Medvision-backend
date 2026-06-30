/**
 * INTEGRATION TESTS — /api/messages
 * POST   /api/messages
 * GET    /api/messages/contacts
 * GET    /api/messages/:userId
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

// ─── POST /api/messages ───────────────────────────────────────────────────────

describe('POST /api/messages', () => {

  it('TC-01 | send message with confirmed appointment → 200', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();

    await createConfirmedAppointment(patient.id, doctor.id);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Hello doctor!' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Hello doctor!');
    expect(res.body.senderId).toBe(patient.id);
    expect(res.body.receiverId).toBe(doctor.id);
  });

  it('TC-02 | send message WITHOUT any appointment → 403 permission denied', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    // No appointment created

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Hello?' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Messaging requires a confirmed appointment.');
  });

  it('TC-03 | send message with only PENDING appointment (not confirmed) → 403', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();

    // Create a PENDING appointment (not confirmed)
    await createAppointment(patient.id, doctor.id);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Hello?' });

    expect(res.status).toBe(403);
  });

  it('TC-04 | empty content → 400 validation error', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: '' });

    expect(res.status).toBe(400);
  });

  it('TC-05 | content over 5000 chars → 400 validation error', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    const longContent = 'a'.repeat(5001);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: longContent });

    expect(res.status).toBe(400);
  });

  it('TC-06 | missing receiverId → 400 validation error', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello' });

    expect(res.status).toBe(400);
  });

  it('TC-07 | no token → 401', async () => {
    const res = await request(app)
      .post('/api/messages')
      .send({ receiverId: 1, content: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('TC-08 | message stored with isRead: false by default', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'New message' });

    expect(res.body.isRead).toBe(false);
  });

});

// ─── GET /api/messages/contacts ──────────────────────────────────────────────

describe('GET /api/messages/contacts', () => {

  it('TC-09 | returns list of users you have exchanged messages with', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor }                       = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Hi doc' });

    const res = await request(app)
      .get('/api/messages/contacts')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(c => c.id === doctor.id)).toBe(true);
  });

  it('TC-10 | returns empty array when no messages yet', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/messages/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('TC-11 | no token → 401', async () => {
    const res = await request(app).get('/api/messages/contacts');
    expect(res.status).toBe(401);
  });

});

// ─── GET /api/messages/:userId ────────────────────────────────────────────────

describe('GET /api/messages/:userId', () => {

  it('TC-12 | returns message thread between two users', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor, token: doctorToken }   = await createDoctor();
    await createConfirmedAppointment(patient.id, doctor.id);

    // Patient sends to doctor
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor.id, content: 'Message 1' });

    // Doctor replies to patient
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ receiverId: patient.id, content: 'Reply 1' });

    const res = await request(app)
      .get(`/api/messages/${doctor.id}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('TC-13 | thread only shows messages between the two users, not others', async () => {
    const { user: patient, token: patientToken } = await createPatient();
    const { user: doctor1 }                      = await createDoctor();
    const { user: doctor2, token: doc2Token }    = await createDoctor();

    await createConfirmedAppointment(patient.id, doctor1.id);
    await createConfirmedAppointment(patient.id, doctor2.id);

    // Patient messages doctor1
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor1.id, content: 'To doctor1' });

    // Patient messages doctor2
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ receiverId: doctor2.id, content: 'To doctor2' });

    // Get thread between patient and doctor1 only
    const res = await request(app)
      .get(`/api/messages/${doctor1.id}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('To doctor1');
  });

  it('TC-14 | no token → 401', async () => {
    const res = await request(app).get('/api/messages/1');
    expect(res.status).toBe(401);
  });

});

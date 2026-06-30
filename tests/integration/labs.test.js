/**
 * INTEGRATION TESTS — /api/labs
 * GET    /api/labs
 * POST   /api/labs
 * PUT    /api/labs/:id
 * DELETE /api/labs/:id
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import { createAdmin, createPatient, createDoctor, createLab } from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

const NEW_LAB = {
  name:    'Cairo Medical Lab',
  address: '10 Tahrir Square, Cairo',
  phone:   '01012345678',
  rating:  4.5,
  services: [
    { name: 'CBC Blood Test', price: 150 },
    { name: 'X-Ray',          price: 350 },
  ],
};

// ─── GET /api/labs ────────────────────────────────────────────────────────────

describe('GET /api/labs', () => {

  it('TC-01 | authenticated user gets all labs with services', async () => {
    const { token } = await createPatient();
    await createLab();
    await createLab();

    const res = await request(app)
      .get('/api/labs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('services');
    expect(Array.isArray(res.body[0].services)).toBe(true);
  });

  it('TC-02 | doctor token also works for GET', async () => {
    const { token } = await createDoctor();
    await createLab();

    const res = await request(app)
      .get('/api/labs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('TC-03 | no token → 401', async () => {
    const res = await request(app).get('/api/labs');
    expect(res.status).toBe(401);
  });

  it('TC-04 | returns empty array when no labs exist', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/labs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

});

// ─── POST /api/labs ───────────────────────────────────────────────────────────

describe('POST /api/labs', () => {

  it('TC-05 | admin creates lab with services → 201', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send(NEW_LAB);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(NEW_LAB.name);
    expect(res.body.services).toHaveLength(2);
  });

  it('TC-06 | admin creates lab without services → 201 with empty services array', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Simple Lab', address: '1 Test St' });

    expect(res.status).toBe(201);
    expect(res.body.services).toHaveLength(0);
  });

  it('TC-07 | patient tries to create → 403 forbidden', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send(NEW_LAB);

    expect(res.status).toBe(403);
  });

  it('TC-08 | doctor tries to create → 403 forbidden', async () => {
    const { token } = await createDoctor();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send(NEW_LAB);

    expect(res.status).toBe(403);
  });

  it('TC-09 | BUG-003 FIXED: missing name returns 400 (validation working)', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'Some Address' }); // name is missing

    // BUG-003 is now FIXED — validation middleware returns 400
    expect(res.status).toBe(400); // ← correctly validates now
  });

  it('TC-10 | no token → 401', async () => {
    const res = await request(app).post('/api/labs').send(NEW_LAB);
    expect(res.status).toBe(401);
  });

});

// ─── PUT /api/labs/:id ────────────────────────────────────────────────────────

describe('PUT /api/labs/:id', () => {

  it('TC-11 | admin updates lab name and address → 200', async () => {
    const { token } = await createAdmin();
    const lab = await createLab();

    const res = await request(app)
      .put(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Lab Name', address: 'New Address' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Lab Name');
  });

  it('TC-12 | updating with new services fully replaces old ones', async () => {
    const { token } = await createAdmin();
    const lab = await createLab(); // has 2 services from factory

    const res = await request(app)
      .put(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: lab.name,
        address: lab.address,
        services: [{ name: 'Only New Service', price: 200 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0].name).toBe('Only New Service');
  });

  it('TC-13 | patient tries to update → 403', async () => {
    const { token } = await createPatient();
    const lab = await createLab();

    const res = await request(app)
      .put(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hack' });

    expect(res.status).toBe(403);
  });

  it('TC-14 | no token → 401', async () => {
    const lab = await createLab();
    const res = await request(app).put(`/api/labs/${lab.id}`).send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

});

// ─── DELETE /api/labs/:id ─────────────────────────────────────────────────────

describe('DELETE /api/labs/:id', () => {

  it('TC-15 | admin deletes lab → 200 + lab removed from DB', async () => {
    const { token } = await createAdmin();
    const lab = await createLab();

    const res = await request(app)
      .delete(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Lab deleted successfully');

    const deleted = await prisma.lab.findUnique({ where: { id: lab.id } });
    expect(deleted).toBeNull();
  });

  it('TC-16 | deleting a lab also removes its services (cascade)', async () => {
    const { token } = await createAdmin();
    const lab = await createLab(); // factory creates lab with 2 services
    const labId = lab.id;

    await request(app)
      .delete(`/api/labs/${labId}`)
      .set('Authorization', `Bearer ${token}`);

    const services = await prisma.labService.findMany({ where: { labId } });
    expect(services).toHaveLength(0);
  });

  it('TC-17 | patient tries to delete → 403', async () => {
    const { token } = await createPatient();
    const lab = await createLab();

    const res = await request(app)
      .delete(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('TC-18 | doctor tries to delete → 403', async () => {
    const { token } = await createDoctor();
    const lab = await createLab();

    const res = await request(app)
      .delete(`/api/labs/${lab.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('TC-19 | no token → 401', async () => {
    const lab = await createLab();
    const res = await request(app).delete(`/api/labs/${lab.id}`);
    expect(res.status).toBe(401);
  });

});

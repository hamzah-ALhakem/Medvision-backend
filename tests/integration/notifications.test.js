/**
 * INTEGRATION TESTS — /api/notifications
 * GET   /api/notifications
 * PUT   /api/notifications/read          (mark all)
 * PUT   /api/notifications/:id/read      (mark one)
 * PUT   /api/notifications/chat/:senderId
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/setup.js';
import { createPatient, createDoctor, createNotification } from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─── GET /api/notifications ───────────────────────────────────────────────────

describe('GET /api/notifications', () => {

  it('TC-01 | authenticated user gets their notifications', async () => {
    const { user, token } = await createPatient();
    await createNotification(user.id, { message: 'Notif 1', type: 'info' });
    await createNotification(user.id, { message: 'Notif 2', type: 'appointment' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('TC-02 | returns only the requesting user\'s notifications (not others)', async () => {
    const { user: user1, token: token1 } = await createPatient();
    const { user: user2 }                = await createPatient();

    await createNotification(user1.id, { message: 'For user1', type: 'info' });
    await createNotification(user2.id, { message: 'For user2', type: 'info' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].message).toBe('For user1');
  });

  it('TC-03 | returns empty array when user has no notifications', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('TC-04 | no token → 401', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

});

// ─── PUT /api/notifications/read (mark ALL) ───────────────────────────────────

describe('PUT /api/notifications/read', () => {

  it('TC-05 | marks all unread notifications as read → 200 success', async () => {
    const { user, token } = await createPatient();
    await createNotification(user.id, { type: 'info' });
    await createNotification(user.id, { type: 'info' });

    const res = await request(app)
      .put('/api/notifications/read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-06 | after marking all read, GET returns notifications with isRead: true', async () => {
    const { user, token } = await createPatient();
    await createNotification(user.id, { type: 'info' });

    await request(app)
      .put('/api/notifications/read')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    res.body.forEach(n => expect(n.isRead).toBe(true));
  });

  it('TC-07 | no token → 401', async () => {
    const res = await request(app).put('/api/notifications/read');
    expect(res.status).toBe(401);
  });

});

// ─── PUT /api/notifications/:id/read (mark ONE) ───────────────────────────────

describe('PUT /api/notifications/:id/read', () => {

  it('TC-08 | marks own notification as read → 200 success', async () => {
    const { user, token } = await createPatient();
    const notif = await createNotification(user.id, { type: 'info' });

    const res = await request(app)
      .put(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-09 | marks another user\'s notification → 404 not found', async () => {
    const { user: user1 }         = await createPatient();
    const { token: token2 }       = await createPatient();
    const notif = await createNotification(user1.id, { type: 'info' });

    // user2 tries to mark user1's notification
    const res = await request(app)
      .put(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });

  it('TC-10 | non-existent notification ID → 404', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/notifications/999999/read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('TC-11 | no token → 401', async () => {
    const res = await request(app).put('/api/notifications/1/read');
    expect(res.status).toBe(401);
  });

});

// ─── PUT /api/notifications/chat/:senderId ────────────────────────────────────

describe('PUT /api/notifications/chat/:senderId', () => {

  it('TC-12 | marks message-type notifications from sender as read → 200', async () => {
    const { user: receiver, token } = await createPatient();
    const { user: sender }          = await createDoctor();

    await createNotification(receiver.id, {
      type: 'message', relatedId: sender.id, message: 'New message',
    });

    const res = await request(app)
      .put(`/api/notifications/chat/${sender.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('TC-13 | works with no matching notifications (no error) → 200', async () => {
    const { token }        = await createPatient();
    const { user: sender } = await createDoctor();

    const res = await request(app)
      .put(`/api/notifications/chat/${sender.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('TC-14 | no token → 401', async () => {
    const res = await request(app).put('/api/notifications/chat/1');
    expect(res.status).toBe(401);
  });

});

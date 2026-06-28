/**
 * UNIT TESTS — notification.service.js
 *
 * Tests all notification service functions against the test database.
 *
 * Run: npm run test:unit
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import {
  createNotification,
  getNotifications,
  markAllRead,
  markOneRead,
  markChatRead,
  markAppointmentNotificationsRead,
} from '../../src/services/notification.service.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import { createPatient, createDoctor } from '../helpers/factories.js';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// createNotification
// ─────────────────────────────────────────────────────────────────────────────

describe('createNotification', () => {

  it('TC-01 | creates a notification with isRead: false by default', async () => {
    const { user } = await createPatient();

    const notif = await createNotification({
      userId:  user.id,
      message: 'You have a new appointment',
      type:    'appointment',
    });

    expect(notif).toHaveProperty('id');
    expect(notif.isRead).toBe(false);
    expect(notif.userId).toBe(user.id);
    expect(notif.message).toBe('You have a new appointment');
    expect(notif.type).toBe('appointment');
  });

  it('TC-02 | relatedId defaults to null when not provided', async () => {
    const { user } = await createPatient();

    const notif = await createNotification({
      userId:  user.id,
      message: 'Test',
      type:    'info',
    });

    expect(notif.relatedId).toBeNull();
  });

  it('TC-03 | relatedId is stored when provided', async () => {
    const { user } = await createPatient();

    const notif = await createNotification({
      userId:    user.id,
      message:   'Test',
      type:      'appointment',
      relatedId: 42,
    });

    expect(notif.relatedId).toBe(42);
  });

  it('TC-04 | type defaults to "info" when not provided', async () => {
    const { user } = await createPatient();

    const notif = await createNotification({
      userId:  user.id,
      message: 'Info message',
    });

    expect(notif.type).toBe('info');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// getNotifications
// ─────────────────────────────────────────────────────────────────────────────

describe('getNotifications', () => {

  it('TC-05 | returns notifications for the correct user only', async () => {
    const { user: user1 } = await createPatient();
    const { user: user2 } = await createPatient();

    await createNotification({ userId: user1.id, message: 'For user1', type: 'info' });
    await createNotification({ userId: user1.id, message: 'Also user1', type: 'info' });
    await createNotification({ userId: user2.id, message: 'For user2', type: 'info' });

    const result = await getNotifications(user1.id);

    expect(result).toHaveLength(2);
    result.forEach(n => expect(n.userId).toBe(user1.id));
  });

  it('TC-06 | returns maximum 20 notifications (take limit)', async () => {
    const { user } = await createPatient();

    // Create 25 notifications
    for (let i = 0; i < 25; i++) {
      await createNotification({ userId: user.id, message: `Notification ${i}`, type: 'info' });
    }

    const result = await getNotifications(user.id);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('TC-07 | returns empty array when user has no notifications', async () => {
    const { user } = await createPatient();
    const result = await getNotifications(user.id);
    expect(result).toEqual([]);
  });

  it('TC-08 | notifications are ordered newest first (desc)', async () => {
    const { user } = await createPatient();

    const first  = await createNotification({ userId: user.id, message: 'First',  type: 'info' });
    const second = await createNotification({ userId: user.id, message: 'Second', type: 'info' });

    const result = await getNotifications(user.id);

    // Newest (second) should come first
    expect(result[0].id).toBe(second.id);
    expect(result[1].id).toBe(first.id);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// markAllRead
// ─────────────────────────────────────────────────────────────────────────────

describe('markAllRead', () => {

  it('TC-09 | marks all unread notifications as read for the user', async () => {
    const { user } = await createPatient();

    await createNotification({ userId: user.id, message: 'A', type: 'info' });
    await createNotification({ userId: user.id, message: 'B', type: 'info' });
    await createNotification({ userId: user.id, message: 'C', type: 'info' });

    await markAllRead(user.id);

    const remaining = await prisma.notification.findMany({
      where: { userId: user.id, isRead: false },
    });

    expect(remaining).toHaveLength(0);
  });

  it('TC-10 | does NOT affect notifications of other users', async () => {
    const { user: user1 } = await createPatient();
    const { user: user2 } = await createPatient();

    await createNotification({ userId: user1.id, message: 'User1 notif', type: 'info' });
    await createNotification({ userId: user2.id, message: 'User2 notif', type: 'info' });

    await markAllRead(user1.id);

    const user2Unread = await prisma.notification.findMany({
      where: { userId: user2.id, isRead: false },
    });

    expect(user2Unread).toHaveLength(1); // user2's notification is untouched
  });

  it('TC-11 | already-read notifications remain read (no error)', async () => {
    const { user } = await createPatient();

    const notif = await createNotification({ userId: user.id, message: 'Already read', type: 'info' });
    await prisma.notification.update({ where: { id: notif.id }, data: { isRead: true } });

    // Should not throw
    await expect(markAllRead(user.id)).resolves.not.toThrow();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// markOneRead
// ─────────────────────────────────────────────────────────────────────────────

describe('markOneRead', () => {

  it('TC-12 | marks a single notification as read', async () => {
    const { user } = await createPatient();
    const notif = await createNotification({ userId: user.id, message: 'Test', type: 'info' });

    await markOneRead(notif.id, user.id);

    const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(updated.isRead).toBe(true);
  });

  it('TC-13 | throws 404 when notification does not belong to the user', async () => {
    const { user: user1 } = await createPatient();
    const { user: user2 } = await createPatient();

    const notif = await createNotification({ userId: user1.id, message: 'User1 notif', type: 'info' });

    // user2 tries to mark user1's notification
    const error = await markOneRead(notif.id, user2.id).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Notification not found');
    expect(error.statusCode).toBe(404);
  });

  it('TC-14 | throws 404 for a non-existent notification ID', async () => {
    const { user } = await createPatient();

    const error = await markOneRead(999999, user.id).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// markChatRead
// ─────────────────────────────────────────────────────────────────────────────

describe('markChatRead', () => {

  it('TC-15 | marks only message-type notifications from a specific sender as read', async () => {
    const { user: receiver } = await createPatient();
    const { user: sender1 }  = await createDoctor();
    const { user: sender2 }  = await createDoctor();

    // Notifications from sender1 (message type)
    await createNotification({ userId: receiver.id, message: 'Msg from sender1', type: 'message', relatedId: sender1.id });
    await createNotification({ userId: receiver.id, message: 'Msg from sender1', type: 'message', relatedId: sender1.id });

    // Notification from sender2 (should NOT be affected)
    await createNotification({ userId: receiver.id, message: 'Msg from sender2', type: 'message', relatedId: sender2.id });

    // Appointment notification (should NOT be affected)
    await createNotification({ userId: receiver.id, message: 'Appointment', type: 'appointment', relatedId: sender1.id });

    await markChatRead(receiver.id, sender1.id);

    const unread = await prisma.notification.findMany({
      where: { userId: receiver.id, isRead: false },
    });

    // Only sender2's message and the appointment notification remain unread
    expect(unread).toHaveLength(2);
    unread.forEach(n => {
      const isFromSender1Message = n.type === 'message' && n.relatedId === sender1.id;
      expect(isFromSender1Message).toBe(false);
    });
  });

  it('TC-16 | does nothing (no error) when no matching notifications exist', async () => {
    const { user: receiver } = await createPatient();
    const { user: sender }   = await createDoctor();

    await expect(markChatRead(receiver.id, sender.id)).resolves.not.toThrow();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// markAppointmentNotificationsRead
// ─────────────────────────────────────────────────────────────────────────────

describe('markAppointmentNotificationsRead', () => {

  it('TC-17 | marks appointment-type notifications for a specific appointment as read', async () => {
    const { user: doctor } = await createDoctor();

    const apptId1 = 101;
    const apptId2 = 102;

    await createNotification({ userId: doctor.id, message: 'Appt 1', type: 'appointment', relatedId: apptId1 });
    await createNotification({ userId: doctor.id, message: 'Appt 1 again', type: 'appointment', relatedId: apptId1 });
    await createNotification({ userId: doctor.id, message: 'Appt 2', type: 'appointment', relatedId: apptId2 });

    await markAppointmentNotificationsRead(doctor.id, apptId1);

    const unread = await prisma.notification.findMany({
      where: { userId: doctor.id, isRead: false },
    });

    // Only apptId2 notification should remain unread
    expect(unread).toHaveLength(1);
    expect(unread[0].relatedId).toBe(apptId2);
  });

});

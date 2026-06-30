/**
 * UNIT TESTS — appointment.service.js
 *
 * Tests createAppointment, getAppointments, and updateStatus
 * against the real test database (medvision_test).
 *
 * Run: npm run test:unit
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import {
  createAppointment,
  getAppointments,
  updateStatus,
} from '../../src/services/appointment.service.js';
import { cleanDatabase, disconnectDatabase } from '../helpers/setup.js';
import {
  createPatient,
  createDoctor,
} from '../helpers/factories.js';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FUTURE_DATE = '2027-03-20';
const SLOT_TIME   = '10:00';

// ─────────────────────────────────────────────────────────────────────────────
// createAppointment
// ─────────────────────────────────────────────────────────────────────────────

describe('createAppointment', () => {

  it('TC-01 | creates appointment on a free slot with status PENDING', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id,
      doctorId:  doctor.id,
      date:      FUTURE_DATE,
      time:      SLOT_TIME,
      reason:    'Routine checkup',
    });

    expect(appt).toHaveProperty('id');
    expect(appt.status).toBe('PENDING');
    expect(appt.patientId).toBe(patient.id);
    expect(appt.doctorId).toBe(doctor.id);
    expect(appt.time).toBe(SLOT_TIME);
  });

  it('TC-02 | returns patient name in the response (include works)', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id,
      doctorId:  doctor.id,
      date:      FUTURE_DATE,
      time:      SLOT_TIME,
    });

    expect(appt.patient).toHaveProperty('firstName');
    expect(appt.patient).toHaveProperty('lastName');
  });

  it('TC-03 | double-booking same slot throws 409 error', async () => {
    const { user: patient1 } = await createPatient();
    const { user: patient2 } = await createPatient();
    const { user: doctor }   = await createDoctor();

    // First booking succeeds
    await createAppointment({
      patientId: patient1.id,
      doctorId:  doctor.id,
      date:      FUTURE_DATE,
      time:      SLOT_TIME,
    });

    // Second patient tries same slot with the same doctor
    const error = await createAppointment({
      patientId: patient2.id,
      doctorId:  doctor.id,
      date:      FUTURE_DATE,
      time:      SLOT_TIME,
    }).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('This time slot is already booked');
    expect(error.statusCode).toBe(409);
  });

  it('TC-04 | same slot at different time does NOT conflict', async () => {
    const { user: patient1 } = await createPatient();
    const { user: patient2 } = await createPatient();
    const { user: doctor }   = await createDoctor();

    await createAppointment({ patientId: patient1.id, doctorId: doctor.id, date: FUTURE_DATE, time: '10:00' });

    const appt2 = await createAppointment({
      patientId: patient2.id,
      doctorId:  doctor.id,
      date:      FUTURE_DATE,
      time:      '11:00', // different time
    });

    expect(appt2).toHaveProperty('id');
    expect(appt2.status).toBe('PENDING');
  });

  it('TC-05 | CANCELLED slot can be rebooked (no conflict)', async () => {
    const { user: patient1 } = await createPatient();
    const { user: patient2 } = await createPatient();
    const { user: doctor }   = await createDoctor();

    // Book then cancel
    const first = await createAppointment({
      patientId: patient1.id, doctorId: doctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });
    await updateStatus({ appointmentId: first.id, doctorId: doctor.id, status: 'cancelled' });

    // Second patient should be able to book the same slot
    const second = await createAppointment({
      patientId: patient2.id, doctorId: doctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });

    expect(second).toHaveProperty('id');
    expect(second.status).toBe('PENDING');
  });

  it('TC-06 | two different doctors can have the same slot without conflict', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor1 } = await createDoctor();
    const { user: doctor2 } = await createDoctor();

    await createAppointment({ patientId: patient.id, doctorId: doctor1.id, date: FUTURE_DATE, time: SLOT_TIME });
    const appt2 = await createAppointment({ patientId: patient.id, doctorId: doctor2.id, date: FUTURE_DATE, time: SLOT_TIME });

    expect(appt2).toHaveProperty('id');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// getAppointments
// ─────────────────────────────────────────────────────────────────────────────

describe('getAppointments', () => {

  it('TC-07 | PATIENT role returns only their own appointments (flat array)', async () => {
    const { user: patient1 } = await createPatient();
    const { user: patient2 } = await createPatient();
    const { user: doctor }   = await createDoctor();

    await createAppointment({ patientId: patient1.id, doctorId: doctor.id, date: FUTURE_DATE, time: '09:00' });
    await createAppointment({ patientId: patient2.id, doctorId: doctor.id, date: FUTURE_DATE, time: '10:00' });

    const result = await getAppointments({ userId: patient1.id, role: 'PATIENT' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].patient_id).toBe(patient1.id);
  });

  it('TC-08 | DOCTOR role returns only their own appointments', async () => {
    const { user: patient }  = await createPatient();
    const { user: doctor1 }  = await createDoctor();
    const { user: doctor2 }  = await createDoctor();

    await createAppointment({ patientId: patient.id, doctorId: doctor1.id, date: FUTURE_DATE, time: '09:00' });
    await createAppointment({ patientId: patient.id, doctorId: doctor2.id, date: FUTURE_DATE, time: '10:00' });

    const result = await getAppointments({ userId: doctor1.id, role: 'DOCTOR' });

    expect(result).toHaveLength(1);
    expect(result[0].doctor_id).toBe(doctor1.id);
  });

  it('TC-09 | PATIENT result contains doctor info (first_name, specialty)', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    const result = await getAppointments({ userId: patient.id, role: 'PATIENT' });

    expect(result[0]).toHaveProperty('first_name');
    expect(result[0]).toHaveProperty('specialty');
  });

  it('TC-10 | status is returned in lowercase', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    const result = await getAppointments({ userId: patient.id, role: 'PATIENT' });
    expect(result[0].status).toBe('pending');
  });

  it('TC-11 | pagination returns { data, pagination } object', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    // Create 3 appointments at different times
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: '08:00' });
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: '09:00' });
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: '10:00' });

    const result = await getAppointments({ userId: patient.id, role: 'PATIENT', page: 1, limit: 2 });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(result.data).toHaveLength(2);
    expect(result.pagination.total).toBe(3);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(2);
  });

  it('TC-12 | no page/limit returns flat array (backward compatibility)', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: SLOT_TIME });

    const result = await getAppointments({ userId: patient.id, role: 'PATIENT' });

    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('pagination');
  });

  it('TC-13 | page 2 returns correct offset of records', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: '08:00' });
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: '09:00' });
    await createAppointment({ patientId: patient.id, doctorId: doctor.id, date: FUTURE_DATE, time: '10:00' });

    const page2 = await getAppointments({ userId: patient.id, role: 'PATIENT', page: 2, limit: 2 });

    expect(page2.data).toHaveLength(1); // 3 total, page 2 with limit 2 = 1 remaining
    expect(page2.pagination.page).toBe(2);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('updateStatus', () => {

  it('TC-14 | owning doctor can confirm an appointment', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id, doctorId: doctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });

    const updated = await updateStatus({
      appointmentId: appt.id,
      doctorId:      doctor.id,
      status:        'confirmed',
    });

    expect(updated.status).toBe('CONFIRMED');
  });

  it('TC-15 | owning doctor can cancel an appointment', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id, doctorId: doctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });

    const updated = await updateStatus({
      appointmentId: appt.id,
      doctorId:      doctor.id,
      status:        'cancelled',
    });

    expect(updated.status).toBe('CANCELLED');
  });

  it('TC-16 | status input is case-insensitive — stored as uppercase', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id, doctorId: doctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });

    const updated = await updateStatus({
      appointmentId: appt.id,
      doctorId:      doctor.id,
      status:        'CONFIRMED', // uppercase input
    });

    expect(updated.status).toBe('CONFIRMED');
  });

  it('TC-17 | different doctor cannot update another doctor\'s appointment — throws 404', async () => {
    const { user: patient }       = await createPatient();
    const { user: owningDoctor }  = await createDoctor();
    const { user: otherDoctor }   = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id, doctorId: owningDoctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });

    const error = await updateStatus({
      appointmentId: appt.id,
      doctorId:      otherDoctor.id, // wrong doctor
      status:        'confirmed',
    }).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Appointment not found or access denied');
    expect(error.statusCode).toBe(404);
  });

  it('TC-18 | updating non-existent appointment ID throws 404', async () => {
    const { user: doctor } = await createDoctor();

    const error = await updateStatus({
      appointmentId: 999999,
      doctorId:      doctor.id,
      status:        'confirmed',
    }).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
  });

  it('TC-19 | updated appointment includes doctor and patient names', async () => {
    const { user: patient } = await createPatient();
    const { user: doctor }  = await createDoctor();

    const appt = await createAppointment({
      patientId: patient.id, doctorId: doctor.id,
      date: FUTURE_DATE, time: SLOT_TIME,
    });

    const updated = await updateStatus({
      appointmentId: appt.id, doctorId: doctor.id, status: 'confirmed',
    });

    expect(updated.doctor).toHaveProperty('firstName');
    expect(updated.patient).toHaveProperty('firstName');
  });

});

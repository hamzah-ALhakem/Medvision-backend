/**
 * MedVision — k6 Load Test Suite
 *
 * Scenarios:
 *   1. Read load       — GET /api/users/doctors (20 VUs, 60s)
 *   2. Auth load       — POST /api/auth/login   (10 VUs, 30s)
 *   3. Double-booking  — 5 VUs all book same slot simultaneously
 *   4. Mixed realistic — login → doctors → book → appointments (15 VUs, 45s)
 *
 * Usage:
 *   "C:\Program Files\k6\k6.exe" run load-tests/k6-load-test.js
 *
 * Requirements:
 *   - Set BASE_URL below to the deployed backend API URL
 *   - The credentials below must exist in the production database
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── CONFIG — update BASE_URL before running ──────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'https://YOUR-BACKEND-URL.vercel.app/api';

const CREDENTIALS = {
  patient: { email: 'ahmed@gmail.com',       password: 'bismillah99' },
  doctor:  { email: 'hamza@gmail.com',        password: 'bismillah99' },
  admin:   { email: 'admin@medvision.com',    password: 'password123' },
};

// ─── Custom Metrics ───────────────────────────────────────────────────────────

const errorRate      = new Rate('error_rate');
const loginDuration  = new Trend('login_duration_ms');
const doctorsDuration = new Trend('get_doctors_duration_ms');
const bookingErrors  = new Counter('booking_conflict_errors');

// ─── Thresholds (pass/fail criteria) ─────────────────────────────────────────

export const options = {
  scenarios: {

    // Scenario 1: Read load — GET /api/users/doctors
    read_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      tags: { scenario: 'read_load' },
    },

    // Scenario 2: Auth load — POST /api/auth/login
    auth_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      startTime: '65s',  // starts after read_load finishes
      tags: { scenario: 'auth_load' },
    },

    // Scenario 3: Concurrent double-booking stress test
    double_booking: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 5,       // each VU runs once — all 5 hit the same slot
      startTime: '100s',
      tags: { scenario: 'double_booking' },
    },

    // Scenario 4: Mixed realistic user journey
    mixed_realistic: {
      executor: 'constant-vus',
      vus: 15,
      duration: '45s',
      startTime: '115s',
      tags: { scenario: 'mixed_realistic' },
    },
  },

  thresholds: {
    // Overall error rate must stay under 5%
    'error_rate': ['rate<0.05'],

    // 95th percentile response time under 1500ms for all requests
    'http_req_duration': ['p(95)<1500'],

    // Login specifically should be under 2000ms p95
    'login_duration_ms': ['p(95)<2000'],

    // Doctor listing (read) should be under 800ms p95
    'get_doctors_duration_ms': ['p(95)<800'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function login(email, password) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS }
  );
  loginDuration.add(Date.now() - start);

  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has token':  (r) => r.json('token') !== undefined,
  });

  errorRate.add(!ok);
  return res.status === 200 ? res.json('token') : null;
}

// ─── Default function — routes to correct scenario based on tag ───────────────

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'read_load';

  if (scenario === 'read_load')       scenarioReadLoad();
  else if (scenario === 'auth_load')  scenarioAuthLoad();
  else if (scenario === 'double_booking') scenarioDoubleBooking();
  else if (scenario === 'mixed_realistic') scenarioMixed();
  else scenarioReadLoad(); // fallback
}

// ─── Scenario 1: Read Load ────────────────────────────────────────────────────

function scenarioReadLoad() {
  group('GET /api/users/doctors', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/users/doctors`);
    doctorsDuration.add(Date.now() - start);

    const ok = check(res, {
      'doctors: status 200':       (r) => r.status === 200,
      'doctors: is array':         (r) => Array.isArray(r.json()),
      'doctors: response < 800ms': (r) => r.timings.duration < 800,
    });

    errorRate.add(!ok);
    sleep(1);
  });
}

// ─── Scenario 2: Auth Load ────────────────────────────────────────────────────

function scenarioAuthLoad() {
  group('POST /api/auth/login', () => {
    // Alternate between valid and invalid credentials to test both paths
    const useValid = Math.random() > 0.3;

    if (useValid) {
      login(CREDENTIALS.patient.email, CREDENTIALS.patient.password);
    } else {
      const res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email: 'wrong@test.com', password: 'wrongpass' }),
        { headers: JSON_HEADERS }
      );
      check(res, {
        'invalid login: status 400': (r) => r.status === 400,
        'invalid login: no 500':     (r) => r.status !== 500,
      });
    }

    sleep(1);
  });
}

// ─── Scenario 3: Concurrent Double-Booking ────────────────────────────────────

function scenarioDoubleBooking() {
  group('Double-booking stress test', () => {
    // All 5 VUs log in as the same patient and try to book the same slot
    const token = login(CREDENTIALS.patient.email, CREDENTIALS.patient.password);
    if (!token) return;

    // First get a doctor ID from the real API
    const doctorsRes = http.get(`${BASE_URL}/users/doctors`);
    if (doctorsRes.status !== 200) return;

    const doctors = doctorsRes.json();
    if (!doctors || doctors.length === 0) return;

    const doctorId = doctors[0].id;

    // All 5 VUs attempt to book the exact same date/time slot
    const res = http.post(
      `${BASE_URL}/appointments`,
      JSON.stringify({
        doctorId: doctorId,
        date:     '2027-12-01',
        time:     '10:00',
        reason:   'Load test booking',
      }),
      { headers: authHeaders(token) }
    );

    // Valid outcomes: 201 (first one wins) or 409 (slot already taken)
    const isValidOutcome = res.status === 201 || res.status === 409;

    check(res, {
      'booking: valid outcome (201 or 409)': () => isValidOutcome,
      'booking: no 500 errors':              (r) => r.status !== 500,
    });

    if (res.status === 409) {
      bookingErrors.add(1); // count the conflicts (expected)
    }

    errorRate.add(!isValidOutcome);
  });
}

// ─── Scenario 4: Mixed Realistic User Journey ─────────────────────────────────

function scenarioMixed() {
  group('Full user journey', () => {

    // Step 1: Login as patient
    const token = login(CREDENTIALS.patient.email, CREDENTIALS.patient.password);
    if (!token) { sleep(1); return; }

    sleep(0.5);

    // Step 2: Browse doctors
    const doctorsRes = http.get(
      `${BASE_URL}/users/doctors`,
      { headers: authHeaders(token) }
    );

    const doctorsOk = check(doctorsRes, {
      'journey: get doctors 200': (r) => r.status === 200,
    });
    errorRate.add(!doctorsOk);

    if (doctorsRes.status !== 200) { sleep(1); return; }

    sleep(0.5);

    // Step 3: View appointments
    const apptsRes = http.get(
      `${BASE_URL}/appointments`,
      { headers: authHeaders(token) }
    );

    const apptsOk = check(apptsRes, {
      'journey: get appointments 200': (r) => r.status === 200,
      'journey: appointments no 500':  (r) => r.status !== 500,
    });
    errorRate.add(!apptsOk);

    sleep(0.5);

    // Step 4: Check notifications
    const notifsRes = http.get(
      `${BASE_URL}/notifications`,
      { headers: authHeaders(token) }
    );

    const notifsOk = check(notifsRes, {
      'journey: get notifications 200': (r) => r.status === 200,
    });
    errorRate.add(!notifsOk);

    sleep(1);
  });
}

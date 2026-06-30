/**
 * PHASE 6 — NEW FEATURES TESTS
 *
 * Tests for features added by the backend developer:
 *   Feature 1 — Email Verification (Magic Link)
 *   Feature 2 — Password Reset Pipeline
 *   Feature 3 — Profile Pictures (Base64 image upload)
 *
 * Run: npm test -- tests/integration/new-features.test.js
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../server.js';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup.js';
import {
  createPatient, createDoctor, createAdmin,
} from '../helpers/factories.js';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await disconnectDatabase(); });

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1 — Email Verification
// ─────────────────────────────────────────────────────────────────────────────

describe('Feature 1 — Email Verification', () => {

  // ── Registration sends verification email ─────────────────────────────────

  it('F1-01 | new patient registration sets isEmailVerified to false by default', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'new@test.com', password: 'SecurePass123',
    });

    expect(res.status).toBe(201);

    // Check DB — isEmailVerified should be false until link is clicked
    const user = await prisma.user.findUnique({ where: { email: 'new@test.com' } });
    expect(user.isEmailVerified).toBe(false);
  });

  it('F1-02 | new patient registration generates a verificationToken in DB', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'verify@test.com', password: 'SecurePass123',
    });

    const user = await prisma.user.findUnique({ where: { email: 'verify@test.com' } });
    // Token should be a non-empty string (hex token)
    expect(typeof user.verificationToken).toBe('string');
    expect(user.verificationToken.length).toBeGreaterThan(0);
  });

  // ── Unverified users blocked from login ───────────────────────────────────

  it('F1-03 | unverified user cannot login — blocked with 403', async () => {
    // Create patient without isEmailVerified = true (factory sets it, so create manually)
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'unverified@test.com', password: 'SecurePass123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'unverified@test.com', password: 'SecurePass123',
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it('F1-04 | verified user (isEmailVerified=true) can login successfully', async () => {
    // Use factory which sets isEmailVerified: true
    await createPatient({ email: 'verified@test.com' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'verified@test.com', password: 'TestPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  // ── GET /api/auth/verify-email/:token ─────────────────────────────────────

  it('F1-05 | valid verification token → marks user as verified', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'toverify@test.com', password: 'SecurePass123',
    });

    const user = await prisma.user.findUnique({ where: { email: 'toverify@test.com' } });
    const token = user.verificationToken;

    const res = await request(app).get(`/api/auth/verify-email/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified successfully/i);
  });

  it('F1-06 | after verification, isEmailVerified becomes true in DB', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'checkdb@test.com', password: 'SecurePass123',
    });

    const user = await prisma.user.findUnique({ where: { email: 'checkdb@test.com' } });
    await request(app).get(`/api/auth/verify-email/${user.verificationToken}`);

    const updated = await prisma.user.findUnique({ where: { email: 'checkdb@test.com' } });
    expect(updated.isEmailVerified).toBe(true);
  });

  it('F1-07 | after verification, verificationToken is cleared from DB', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'cleartoken@test.com', password: 'SecurePass123',
    });

    const user = await prisma.user.findUnique({ where: { email: 'cleartoken@test.com' } });
    await request(app).get(`/api/auth/verify-email/${user.verificationToken}`);

    const updated = await prisma.user.findUnique({ where: { email: 'cleartoken@test.com' } });
    // Token should be cleared after use
    expect(updated.verificationToken).toBeNull();
  });

  it('F1-08 | after verification, user can login successfully', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'loginafter@test.com', password: 'SecurePass123',
    });

    const user = await prisma.user.findUnique({ where: { email: 'loginafter@test.com' } });
    await request(app).get(`/api/auth/verify-email/${user.verificationToken}`);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'loginafter@test.com', password: 'SecurePass123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('F1-09 | invalid or expired verification token → 400', async () => {
    const res = await request(app).get('/api/auth/verify-email/totally-fake-token-xyz');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('F1-10 | same token cannot be used twice (token cleared after first use)', async () => {
    await request(app).post('/api/auth/register').send({
      fullName: 'Ahmed Ali', email: 'oneuse@test.com', password: 'SecurePass123',
    });

    const user = await prisma.user.findUnique({ where: { email: 'oneuse@test.com' } });
    const token = user.verificationToken;

    // First use — succeeds
    await request(app).get(`/api/auth/verify-email/${token}`);

    // Second use — token is now null, should fail
    const res = await request(app).get(`/api/auth/verify-email/${token}`);
    expect(res.status).toBe(400);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2 — Password Reset Pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe('Feature 2 — Password Reset Pipeline', () => {

  // ── POST /api/auth/forgot-password ────────────────────────────────────────

  it('F2-01 | forgot-password with existing email → 200 (safe response, no user enumeration)', async () => {
    await createPatient({ email: 'forgotme@test.com' });

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'forgotme@test.com',
    });

    // Always returns 200 regardless — prevents knowing if email exists
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset link/i);
  });

  it('F2-02 | forgot-password with non-existent email → still 200 (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'doesnotexist@test.com',
    });

    // Must not reveal whether email exists — same 200 response
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset link/i);
  });

  it('F2-03 | forgot-password sets resetPasswordToken in DB for real users', async () => {
    await createPatient({ email: 'resettoken@test.com' });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'resettoken@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'resettoken@test.com' } });
    expect(typeof user.resetPasswordToken).toBe('string');
    expect(user.resetPasswordToken.length).toBeGreaterThan(0);
  });

  it('F2-04 | forgot-password sets resetPasswordExpires to ~1 hour from now', async () => {
    await createPatient({ email: 'expires@test.com' });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'expires@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'expires@test.com' } });
    const now = Date.now();
    const expiresAt = new Date(user.resetPasswordExpires).getTime();
    const diffMinutes = (expiresAt - now) / 60000;

    // Should expire in approximately 60 minutes (allow ±5 min margin)
    expect(diffMinutes).toBeGreaterThan(55);
    expect(diffMinutes).toBeLessThan(65);
  });

  it('F2-05 | missing email body → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});

    expect(res.status).toBe(400);
  });

  it('F2-06 | invalid email format → 400 validation error', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'not-an-email',
    });

    expect(res.status).toBe(400);
  });

  // ── POST /api/auth/reset-password/:token ──────────────────────────────────

  it('F2-07 | valid reset token → password updated successfully', async () => {
    await createPatient({ email: 'willreset@test.com' });

    // Generate reset token
    await request(app).post('/api/auth/forgot-password').send({
      email: 'willreset@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'willreset@test.com' } });
    const token = user.resetPasswordToken;

    const res = await request(app).post(`/api/auth/reset-password/${token}`).send({
      newPassword: 'BrandNewPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset successfully/i);
  });

  it('F2-08 | after reset, user can login with new password', async () => {
    await createPatient({ email: 'newpasstest@test.com' });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'newpasstest@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'newpasstest@test.com' } });

    await request(app).post(`/api/auth/reset-password/${user.resetPasswordToken}`).send({
      newPassword: 'BrandNewPassword123',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'newpasstest@test.com',
      password: 'BrandNewPassword123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
  });

  it('F2-09 | after reset, old password no longer works', async () => {
    await createPatient({ email: 'oldpassblock@test.com' });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'oldpassblock@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'oldpassblock@test.com' } });

    await request(app).post(`/api/auth/reset-password/${user.resetPasswordToken}`).send({
      newPassword: 'BrandNewPassword123',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'oldpassblock@test.com',
      password: 'TestPassword123', // old password
    });

    expect(loginRes.status).toBe(400);
    expect(loginRes.body.message).toBe('Invalid credentials');
  });

  it('F2-10 | after successful reset, resetPasswordToken is cleared from DB', async () => {
    await createPatient({ email: 'clearedreset@test.com' });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'clearedreset@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'clearedreset@test.com' } });
    await request(app).post(`/api/auth/reset-password/${user.resetPasswordToken}`).send({
      newPassword: 'BrandNewPassword123',
    });

    const updated = await prisma.user.findUnique({ where: { email: 'clearedreset@test.com' } });
    expect(updated.resetPasswordToken).toBeNull();
    expect(updated.resetPasswordExpires).toBeNull();
  });

  it('F2-11 | invalid reset token → 400', async () => {
    const res = await request(app).post('/api/auth/reset-password/totally-invalid-token').send({
      newPassword: 'NewPassword123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('F2-12 | expired reset token → 400', async () => {
    await createPatient({ email: 'expiredtoken@test.com' });

    // Manually create an expired token
    await prisma.user.update({
      where: { email: 'expiredtoken@test.com' },
      data: {
        resetPasswordToken: 'expired-token-abc123',
        resetPasswordExpires: new Date(Date.now() - 1000), // expired 1 second ago
      },
    });

    const res = await request(app).post('/api/auth/reset-password/expired-token-abc123').send({
      newPassword: 'NewPassword123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  it('F2-13 | same reset token cannot be used twice', async () => {
    await createPatient({ email: 'reusetoken@test.com' });

    await request(app).post('/api/auth/forgot-password').send({
      email: 'reusetoken@test.com',
    });

    const user = await prisma.user.findUnique({ where: { email: 'reusetoken@test.com' } });
    const token = user.resetPasswordToken;

    // First use — succeeds
    await request(app).post(`/api/auth/reset-password/${token}`).send({
      newPassword: 'FirstNewPassword123',
    });

    // Second use — token is now null, should fail
    const res = await request(app).post(`/api/auth/reset-password/${token}`).send({
      newPassword: 'SecondNewPassword123',
    });

    expect(res.status).toBe(400);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3 — Profile Pictures (Base64 Image Upload)
// ─────────────────────────────────────────────────────────────────────────────

describe('Feature 3 — Profile Pictures', () => {

  // A small valid base64 encoded PNG (1x1 pixel transparent PNG)
  const validBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // ── PUT /api/users/profile — image upload ─────────────────────────────────

  it('F3-01 | user can upload a base64 image via profile update', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Ahmed',
        lastName: 'Ali',
        image: validBase64Image,
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('image');
    expect(res.body.user.image).toBe(validBase64Image);
  });

  it('F3-02 | uploaded image is persisted in DB', async () => {
    const { token, user } = await createPatient();

    await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ahmed', image: validBase64Image });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated.image).toBe(validBase64Image);
  });

  it('F3-03 | image is returned in GET /users/profile response', async () => {
    const { token, user } = await createPatient();

    // Set image
    await prisma.user.update({
      where: { id: user.id },
      data: { image: validBase64Image },
    });

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('image');
    expect(res.body.image).toBe(validBase64Image);
  });

  it('F3-04 | image is included in GET /users/doctors response', async () => {
    const { user: doctor } = await createDoctor();

    // Set doctor image
    await prisma.user.update({
      where: { id: doctor.id },
      data: { image: validBase64Image },
    });

    const res = await request(app).get('/api/users/doctors');

    expect(res.status).toBe(200);
    const foundDoctor = res.body.find(d => d.id === doctor.id);
    expect(foundDoctor).toBeDefined();
    expect(foundDoctor).toHaveProperty('image');
    expect(foundDoctor.image).toBe(validBase64Image);
  });

  it('F3-05 | image is included in login response', async () => {
    await createPatient({ email: 'imglogin@test.com' });

    // Set image directly
    await prisma.user.update({
      where: { email: 'imglogin@test.com' },
      data: { image: validBase64Image },
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'imglogin@test.com', password: 'TestPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty('image');
    expect(res.body.user.image).toBe(validBase64Image);
  });

  it('F3-06 | user with no image returns image as null', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // image field exists but is null when not set
    expect(res.body.image).toBeNull();
  });

  it('F3-07 | image can be cleared by passing null', async () => {
    const { token, user } = await createPatient();

    // First set an image
    await prisma.user.update({
      where: { id: user.id },
      data: { image: validBase64Image },
    });

    // Then clear it
    await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ahmed', image: null });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated.image).toBeNull();
  });

  it('F3-08 | profile update response does NOT contain password even with image', async () => {
    const { token } = await createPatient();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Ahmed', image: validBase64Image });

    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).toHaveProperty('image');
  });

});

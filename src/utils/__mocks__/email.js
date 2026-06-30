/**
 * src/utils/__mocks__/email.js
 *
 * Mock for the email utility — prevents real emails being sent during tests.
 * All email functions become no-op async functions.
 */

export const sendVerificationEmail = () => Promise.resolve();
export const sendPasswordResetEmail = () => Promise.resolve();

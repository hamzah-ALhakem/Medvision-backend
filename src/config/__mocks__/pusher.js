/**
 * src/config/__mocks__/pusher.js
 *
 * Jest manual mock for the Pusher client.
 * Replaced with a no-op object so no real HTTP calls are made during tests.
 * Uses plain functions (no jest.fn()) for ESM compatibility.
 */

const pusher = {
  trigger: () => Promise.resolve(),
  triggerBatch: () => Promise.resolve(),
  get: () => Promise.resolve(),
  post: () => Promise.resolve(),
  authenticate: () => ({}),
  authorizeChannel: () => ({}),
};

export default pusher;

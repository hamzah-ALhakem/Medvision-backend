/**
 * tests/helpers/globalSetup.js
 *
 * Jest global setup — runs ONCE before all test suites.
 * Mocks Pusher so it never makes real HTTP calls during tests.
 *
 * Pusher is mocked at the module level using Jest's module mocking.
 * This file is referenced in jest.config.js via setupFilesAfterFramework.
 */

// Mock the pusher config module so all imports of it get a no-op object
// This is handled via __mocks__ directory — see src/config/__mocks__/pusher.js

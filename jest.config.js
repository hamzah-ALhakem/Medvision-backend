/**
 * Jest configuration for MedVision backend.
 *
 * The project uses ESM ("type": "module" in package.json), so we use
 * the experimental-vm-modules flag (set in package.json test script)
 * and tell Jest NOT to transform files — Node handles ESM natively.
 */

export default {
  // Use Node environment (not jsdom)
  testEnvironment: 'node',

  // Don't transform — let Node handle ESM directly
  transform: {},

  // Where to find tests
  testMatch: [
    '**/tests/**/*.test.js',
  ],

  // Run tests one at a time (important for DB tests to avoid race conditions)
  // This is also set via --runInBand in the npm script
  maxWorkers: 1,

  // How long a single test can take before timing out (30 seconds)
  // Important for DB operations which can be slow
  testTimeout: 30000,

  // Show individual test names in output
  verbose: true,

  // Automatically use manual mocks from __mocks__ directories
  // This makes Jest use src/config/__mocks__/pusher.js instead of the real one
  automock: false,
  moduleNameMapper: {
    // Intercept pusher config import and replace with our mock
    '^(\\.\\./|\\./)*(src/)?config/pusher\\.js$': '<rootDir>/src/config/__mocks__/pusher.js',
  },

  // Force Jest to exit after all tests complete (prevents hanging open handles from server.listen)
  forceExit: true,

  // Coverage settings (used when running npm run test:coverage)
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/utils/logger.js',  // logger is a utility, not business logic
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 70,
    },
  },
};

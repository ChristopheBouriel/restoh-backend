module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!utils/fileStorage.js', // Exclude file storage utilities from coverage
    '!middleware/__mocks__/**', // Exclude mock files from coverage
    '!**/node_modules/**',
    '!coverage/**',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],
  // setupFiles runs BEFORE test environment is set up (for global mocks)
  setupFiles: ['<rootDir>/tests/setupMocks.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: false, // Don't reset mocks between tests (keeps our manual mock)
  restoreMocks: true,
};
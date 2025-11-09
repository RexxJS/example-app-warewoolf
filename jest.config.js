/**
 * Jest configuration for WareWoolf unit tests
 */
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test match patterns
  testMatch: [
    '**/tests/unit/**/*.test.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/components/controllers/woolf-rexx-handler.js',
    'src/components/controllers/woolf-controlbus.js'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Coverage directory
  coverageDirectory: 'test-results/coverage',

  // Verbose output
  verbose: true,

  // Transform (if needed for ES6)
  transform: {},

  // Module paths
  moduleDirectories: ['node_modules', 'src']
};

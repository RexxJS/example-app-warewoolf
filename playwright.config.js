const { defineConfig } = require('@playwright/test');

/**
 * Playwright configuration for WareWoolf RexxJS integration tests
 * Tests the Electron app with RexxJS scripting capabilities
 */
module.exports = defineConfig({
  testDir: './tests',

  // Test timeout
  timeout: 60000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000
  },

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the app
    baseURL: 'http://localhost:3000',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Trace on failure
    trace: 'on-first-retry',
  },

  // Test projects
  projects: [
    {
      name: 'electron-app',
      testMatch: /.*\.electron\.test\.js/,
      use: {
        // Electron-specific settings
      }
    },
    {
      name: 'control-bus',
      testMatch: /.*\.controlbus\.test\.js/,
      use: {
        browserName: 'chromium'
      }
    }
  ],

  // Web server (if needed for control bus tests)
  webServer: {
    command: 'python3 -m http.server 8888',
    port: 8888,
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
});

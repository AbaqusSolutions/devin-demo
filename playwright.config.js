const { defineConfig } = require('@playwright/test');

const python = process.env.E2E_PYTHON || 'venv/bin/python';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:51237',
    browserName: 'chromium',
    headless: false,
    launchOptions: { slowMo: 300 },
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${python}" tests/e2e/fixture_server.py`,
    url: 'http://127.0.0.1:51237',
    reuseExistingServer: false,
    timeout: 90000,
  },
});

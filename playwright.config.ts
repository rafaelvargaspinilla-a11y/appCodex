import { defineConfig, devices } from '@playwright/test';
const port = process.env.TEST_PORT || '4173';
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests', fullyParallel: true,
  use: { baseURL: `${origin}${process.env.TEST_BASE_PATH || '/'}`, launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] }, trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: { command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`, url: `${origin}${process.env.TEST_BASE_PATH || '/'}`, reuseExistingServer: !process.env.CI }
});

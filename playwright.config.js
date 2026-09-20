import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 7_000, toHaveScreenshot: { maxDiffPixelRatio: 0.012 } },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:qa -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-13', use: { ...devices['iPhone 13'] } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'mobile-landscape', use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } },
  ],
});

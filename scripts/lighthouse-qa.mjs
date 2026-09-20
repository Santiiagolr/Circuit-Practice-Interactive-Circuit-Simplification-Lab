import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const port = 4175;
const chromiumInstall = path.dirname(path.dirname(chromium.executablePath()));
const playwrightRoot = path.dirname(chromiumInstall);
const headlessFolder = readdirSync(playwrightRoot)
  .filter((name) => name.startsWith('chromium_headless_shell-'))
  .sort()
  .at(-1);
const headlessPath = headlessFolder
  ? path.join(playwrightRoot, headlessFolder, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
  : chromium.executablePath();
assert.ok(existsSync(headlessPath), `Chromium executable not found: ${headlessPath}`);
const server = await preview({
  preview: { host: '127.0.0.1', port, strictPort: true },
  logLevel: 'error',
});
let chrome;

try {
  chrome = await launch({
    chromePath: headlessPath,
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });
  const result = await lighthouse(`http://127.0.0.1:${port}/`, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility'],
  });
  const performance = Math.round(result.lhr.categories.performance.score * 100);
  const accessibility = Math.round(result.lhr.categories.accessibility.score * 100);
  assert.ok(performance >= 85, `Lighthouse mobile performance must be >=85; received ${performance}.`);
  assert.ok(accessibility >= 95, `Lighthouse accessibility must be >=95; received ${accessibility}.`);
  console.log(`Lighthouse passed: performance ${performance}, accessibility ${accessibility}.`);
} finally {
  if (chrome) {
    try {
      await chrome.kill();
    } catch (error) {
      // Windows can keep the temporary profile locked for a few milliseconds
      // after Chrome has already exited. Do not turn a successful audit into a
      // false negative solely because chrome-launcher could not remove it.
      if (error?.code !== 'EPERM') throw error;
    }
  }
  await new Promise((resolve) => server.httpServer.close(resolve));
}

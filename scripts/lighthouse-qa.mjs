import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForChrome(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Chromium did not expose its debugging endpoint in time.');
}

const previewPort = 4175;
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
  preview: { host: '127.0.0.1', port: previewPort, strictPort: true },
  logLevel: 'error',
});
const chromePort = await getFreePort();
const profileDirectory = mkdtempSync(path.join(tmpdir(), 'circuit-lighthouse-'));
const chromeProcess = spawn(headlessPath, [
  `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profileDirectory}`,
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

try {
  await waitForChrome(chromePort);
  const result = await lighthouse(`http://127.0.0.1:${previewPort}/`, {
    port: chromePort,
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
  if (process.platform === 'win32' && chromeProcess.pid) {
    spawnSync('taskkill.exe', ['/PID', String(chromeProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  }
  if (!chromeProcess.killed) chromeProcess.kill('SIGKILL');
  server.httpServer.closeIdleConnections?.();
  server.httpServer.closeAllConnections?.();
  server.httpServer.close();
  try {
    rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    if (error?.code !== 'EPERM') {
      console.error('Temporary Lighthouse profile cleanup failed:', error);
      process.exitCode = 1;
    }
  }
}

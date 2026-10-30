import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { findManualMove } from '../tests/e2e/helpers.js';

// Record the real application through its visible controls; no game state is injected.
const output = resolve('output/playwright/animations');
await mkdir(output, { recursive: true });
const server = await createServer({ mode: 'qa', server: { host: '127.0.0.1', port: 4177, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: resolve(output, 'video'), size: { width: 1440, height: 1000 } } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const video = page.video();
  await page.goto('http://127.0.0.1:4177/?seed=814&type=L&difficulty=guided&values=equal');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  for (let index = 0; index < 5; index++) {
    if (index === 1) {
      await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
      await page.getByText('Configurar práctica').click();
      await page.getByLabel('Estilo de inductor').selectOption('copper');
      await page.getByText('Configurar práctica').click();
      await page.waitForTimeout(300);
    }
    const move = await findManualMove(page);
    for (const id of move.ids.slice(0, 2)) await page.getByTestId(`component-${id}`).click();
    await page.waitForTimeout(180);
    await page.keyboard.press(move.rule === 'series' ? 'q' : 'e');
    await page.waitForTimeout(850);
  }
  await page.getByRole('button', { name: 'Entregar resultado' }).click();
  await page.waitForTimeout(480);
  await page.screenshot({ path: resolve(output, 'gameplay-dark.png'), fullPage: true });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Usar tema claro' }).click();
  await page.screenshot({ path: resolve(output, 'gameplay-light.png'), fullPage: true });
  await page.waitForTimeout(700);
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
  await video.saveAs(resolve(output, 'circuit-practice-animations.webm'));
  await video.delete();
  console.log(`Recording and theme captures saved to ${output}`);
} finally {
  await browser?.close();
  await server.close();
}

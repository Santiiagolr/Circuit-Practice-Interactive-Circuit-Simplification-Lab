import { chromium, expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectNoHorizontalDocumentOverflow, solveVisibleCircuit } from './helpers.js';

// Chrome reads this native browser preference before opening the page. This is
// not CSS zoom, pinch zoom, device emulation or a smaller viewport override.
// The default storage partition has key "x"; Chrome converts level to factor
// with pow(1.2, level). See Chromium's chrome_zoom_level_prefs.cc and page_zoom.cc.
async function openAtZoom(factor, testInfo) {
  const profile = testInfo.outputPath(`native-zoom-${factor}-profile`);
  await mkdir(path.join(profile, 'Default'), { recursive: true });
  await writeFile(path.join(profile, 'Default', 'Preferences'), JSON.stringify({
    partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } },
  }));
  return chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: null,
    deviceScaleFactor: undefined,
    args: ['--window-size=1280,900'],
  });
}
const metrics = page => page.evaluate(() => ({
  width: innerWidth, height: innerHeight, outerWidth, ratio: devicePixelRatio,
  pinchScale: visualViewport.scale, cssZoom: getComputedStyle(document.documentElement).zoom,
}));

test('native browser zoom at 200 percent preserves all views and manual circuit delivery', async ({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium');
  test.setTimeout(90_000);
  const normal = await openAtZoom(1, testInfo);
  let baseline;
  try {
    const page = normal.pages()[0];
    await page.goto('http://127.0.0.1:4174/?seed=301&type=R');
    baseline = await metrics(page);
  } finally { await normal.close(); }
  const zoomed = await openAtZoom(2, testInfo);
  try {
    const page = zoomed.pages()[0];
    const cdp = await zoomed.newCDPSession(page);
    const capture = async name => {
      // Capture the native surface without a CSS-sized clip: fullPage screenshots
      // otherwise clip the image at half width when browser zoom is 200%.
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      await writeFile(testInfo.outputPath(name), Buffer.from(data, 'base64'));
    };
    await page.goto('http://127.0.0.1:4174/?seed=301&type=R');
    const actual = await metrics(page);
    expect(actual.ratio / baseline.ratio).toBeCloseTo(2, 4);
    expect(actual.width / baseline.width).toBeCloseTo(0.5, 2);
    expect(actual.outerWidth).toBe(baseline.outerWidth);
    expect(actual.pinchScale).toBe(1);
    expect(['1', 'normal']).toContain(actual.cssZoom);
    await writeFile(testInfo.outputPath('native-zoom-metrics.json'), JSON.stringify({ baseline, zoomed: actual }, null, 2));
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
      for (const label of ['Práctica libre', 'Por temas', 'Progreso', 'Historial', 'Parcial']) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await expectNoHorizontalDocumentOverflow(page);
        await page.evaluate(() => { window.scrollTo(0, 0); });
        await capture(`native-200-${theme}-${label}.png`);
      }
    }
    await page.getByRole('button', { name: 'Práctica libre', exact: true }).click();
    await solveVisibleCircuit(page);
    await page.getByRole('button', { name: 'Entregar resultado' }).click();
    await expect(page.getByTestId('completion')).toContainText('¡Circuito resuelto!');
    await expectNoHorizontalDocumentOverflow(page);
    await page.getByTestId('completion').scrollIntoViewIfNeeded();
    await capture('native-200-delivered.png');
  } finally { await zoomed.close(); }
});

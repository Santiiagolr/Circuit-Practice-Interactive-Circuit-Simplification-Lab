import { expect, test } from '@playwright/test';
import { captureRuntimeErrors, findManualMove, selectComponents, solveVisibleCircuit } from './helpers';

test('responsive full-circuit overview baseline', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'tablet', 'iphone-13', 'mobile-landscape'].includes(testInfo.project.name));
  await page.goto('/?seed=2026&difficulty=challenge&type=R&values=varied');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.workbench')).toHaveScreenshot(`workbench-${testInfo.project.name}.png`, { animations: 'disabled' });
});

test('all six geometric families keep their symbols, labels, and routes legible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  const examples = [
    [0, 'Marco rectangular', 'family-frame', false],
    [17, 'Escalera', 'family-ladder', false],
    [14, 'Celdas apiladas', 'family-stacked-cells', false],
    [4, 'Travesaños', 'family-crossbars', false],
    [2, 'Celda triangular', 'family-triangle', true],
    [1, 'Marco con diagonal', 'family-integrated-diagonal', true],
  ];
  for (const [seed, family, snapshot, hasDiagonal] of examples) {
    await page.goto(`/?seed=${seed}&difficulty=challenge&type=R`);
    await expect(page.locator('.exercise-heading p')).toContainText(family);
    if (hasDiagonal) {
      const rotations = await page.locator('[data-component-id] > g').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('transform')?.match(/rotate\((-?[\d.]+)/)?.[1] ?? 0)));
      expect(rotations.some(angle => Math.abs(angle - Math.round(angle / 90) * 90) > 1)).toBe(true);
    }
    await expect(page.locator('.drawing-area')).toHaveScreenshot(`${snapshot}.png`, { animations: 'disabled' });
  }
});

test('selection, topology warning, equivalent and inline result remain legible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=817&difficulty=challenge&type=R');
  const move = await findManualMove(page);
  await selectComponents(page, move.ids);
  await expect(page.locator('.workbench')).toHaveScreenshot('workbench-selected.png', { animations: 'disabled' });
  await page.keyboard.press(move.rule === 'series' ? 'e' : 'q');
  await expect(page.locator('.feedback-strip.error')).toBeVisible();
  await expect(page.locator('.workbench')).toHaveScreenshot('workbench-error.png', { animations: 'disabled' });
  await page.keyboard.press(move.rule === 'series' ? 'q' : 'e');
  await expect(page.locator('.workbench')).toHaveScreenshot('workbench-equivalent.png', { animations: 'disabled' });
  await solveVisibleCircuit(page);
  await expect(page.getByRole('region', { name: 'Circuito reducido' })).toBeVisible();
  await expect(page.locator('.workbench')).toHaveScreenshot('workbench-result.png', { animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('an open switch stays distinct in the full-circuit overview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/?seed=2&difficulty=challenge&type=R');
  const openSwitch = page.locator('svg [data-component-id][aria-label*="Interruptor"][aria-label*="Abierto"]').first();
  if (!await openSwitch.count()) test.skip(true, 'This deterministic topology does not include an open switch.');
  await expect(page.locator('.workbench')).toHaveScreenshot('workbench-open-switch.png', { animations: 'disabled' });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { captureRuntimeErrors, solveVisibleCircuit } from './helpers';

test('initial workspace and formula controls have no serious axe violations', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name));
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=91&mode=advanced&type=R&difficulty=practice');
  await page.getByRole('button', { name: 'Fórmulas' }).click();
  const results = await new AxeBuilder({ page }).exclude('.flow-trace').analyze();
  const blocking = results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact));
  expect(blocking).toEqual([]);
  expect(errors).toEqual([]);
});

test('victory dialog is named, modal and keyboard reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/?seed=44&mode=basic&type=C&difficulty=guided');
  await solveVisibleCircuit(page);
  const dialog = page.getByRole('dialog', { name: 'Circuito reducido' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await dialog.getByRole('button', { name: /Medir otro circuito/ }).focus();
  await expect(dialog.getByRole('button', { name: /Medir otro circuito/ })).toBeFocused();
});

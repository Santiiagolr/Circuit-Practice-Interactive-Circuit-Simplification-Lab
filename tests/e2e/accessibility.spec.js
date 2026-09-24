import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { captureRuntimeErrors, expectNoHorizontalDocumentOverflow, findManualMove, performManualMove } from './helpers';

test('initial exercise and keyboard controls have no serious accessibility violations', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'firefox', 'webkit'].includes(testInfo.project.name));
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=91&difficulty=practice&type=R');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([]);
  await expectNoHorizontalDocumentOverflow(page);
  await expect(page.locator('[data-component-id]').first()).toHaveAttribute('tabindex', '0');
  expect(errors).toEqual([]);
});

test('the mobile detail list exposes named, operable 44px touch targets', async ({ page }, testInfo) => {
  test.skip(!['pixel-7', 'iphone-13', 'tablet', 'mobile-landscape'].includes(testInfo.project.name));
  await page.goto('/?seed=913&difficulty=challenge&type=C');
  const target = page.getByTestId('component-c1');
  const size = await target.boundingBox();
  expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44);
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expectNoHorizontalDocumentOverflow(page);
});

test('fullscreen and result are named and the completed circuit remains reviewable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/?seed=44&difficulty=guided&type=C');
  await page.getByRole('button', { name: 'Pantalla completa' }).click();
  await expect(page.locator('.workbench')).toHaveClass(/desk-fullscreen/);
  await page.keyboard.press('Escape');
  let before = await page.locator('svg [data-component-id]').count();
  while (true) {
    await performManualMove(page, await findManualMove(page));
    const after = await page.locator('svg [data-component-id]').count();
    expect(after).toBeLessThan(before); before = after;
    if (await page.getByRole('region', { name: 'Circuito reducido' }).count()) break;
  }
  const result = page.getByRole('region', { name: 'Circuito reducido' });
  await expect(result).toContainText('Equivalente');
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([]);
  await expect(page.getByRole('button', { name: 'Entregar y continuar' })).toBeVisible();
});

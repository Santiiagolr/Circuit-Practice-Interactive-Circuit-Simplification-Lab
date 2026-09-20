import { expect, test } from '@playwright/test';
import { captureRuntimeErrors, expectNoHorizontalDocumentOverflow, solveVisibleCircuit } from './helpers';

test('loads reproducibly without overflow and supports zoom/fullscreen controls', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=120&mode=advanced&type=R&difficulty=challenge&values=varied');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-qa-mode', 'true');
  await expect(page.getByRole('group', { name: 'Circuito avanzado interactivo' })).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);

  const zoom = page.getByRole('button', { name: 'Ampliar' });
  await zoom.click();
  await expect(page.getByRole('button', { name: 'Ajustar' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ajustar' }).click();

  const fullscreen = page.getByRole('button', { name: 'Abrir mesa de trabajo en pantalla completa' });
  await fullscreen.click();
  await expect(page.locator('.circuit-panel')).toHaveClass(/is-fullscreen-workbench/);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
});

test('mouse, keyboard and touch can complete a deterministic basic exercise', async ({ page }, testInfo) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=301&mode=basic&type=R&difficulty=guided&values=varied');
  const components = page.locator('[data-component-id]');
  const touchProject = ['pixel-7', 'iphone-13', 'tablet', 'mobile-landscape'].includes(testInfo.project.name);
  if (touchProject) {
    await components.nth(0).locator('[data-component-hitbox]').dispatchEvent('click');
    await components.nth(1).locator('[data-component-hitbox]').dispatchEvent('click');
    await page.locator('.topbar-quick').getByRole('button', { name: /^Serie/ }).click();
  } else {
    await components.nth(0).focus();
    await page.keyboard.press('Enter');
    await components.nth(1).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('KeyQ');
  }
  await page.waitForTimeout(50);
  await solveVisibleCircuit(page);
  await expect(page.getByText(/Resistencia equivalente/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('advanced capacitor challenge remains manually solvable after switch pruning', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Full topology matrix runs once; viewport coverage is provided by the other tests.');
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=817&mode=advanced&type=C&difficulty=challenge&values=equal');
  await solveVisibleCircuit(page);
  await expect(page.getByText(/Capacitancia equivalente/)).toBeVisible();
  expect(errors).toEqual([]);
});

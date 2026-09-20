import { expect } from '@playwright/test';

export function captureRuntimeErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));
  return errors;
}

export async function clearSelection(page) {
  const selected = page.locator('[data-component-id][aria-pressed="true"]');
  while (await selected.count()) await selected.first().locator('[data-component-hitbox]').dispatchEvent('click');
}

async function clickComponent(page, id) {
  await page.locator(`[data-component-id="${id}"] [data-component-hitbox]`).dispatchEvent('click');
}

export async function solveVisibleCircuit(page) {
  const topbar = page.locator('.topbar-quick');
  for (let step = 0; step < 120; step += 1) {
    if (await page.getByRole('dialog', { name: 'Circuito reducido' }).count()) return;

    const openSwitch = page.locator('[data-component-type="S"][aria-label*="abierto" i]').first();
    if (await openSwitch.count()) {
      await openSwitch.locator('[data-component-hitbox]').dispatchEvent('click');
      const deleteButton = topbar.getByRole('button', { name: /Eliminar abierto/i });
      if (await deleteButton.count()) {
        await deleteButton.click();
        await page.waitForTimeout(40);
        continue;
      }
      await clearSelection(page);
    }

    const components = page.locator('[data-component-id]');
    const before = await components.count();
    if (before <= 1) break;
    const ids = await components.evaluateAll((items) => items.map((item) => item.getAttribute('data-component-id')));
    let moved = false;

    for (let first = 0; first < ids.length && !moved; first += 1) {
      for (let second = first + 1; second < ids.length && !moved; second += 1) {
        for (const action of ['Serie', 'Paralelo']) {
          await clearSelection(page);
          await clickComponent(page, ids[first]);
          await clickComponent(page, ids[second]);
          await topbar.getByRole('button', { name: new RegExp(`^${action}`) }).click();
          await page.waitForTimeout(45);
          const after = await components.count();
          if (after < before || await page.getByRole('dialog', { name: 'Circuito reducido' }).count()) {
            moved = true;
            break;
          }
        }
      }
    }
    expect(moved, 'The visible circuit should always offer a manual reduction').toBe(true);
  }
  await expect(page.getByRole('dialog', { name: 'Circuito reducido' })).toBeVisible();
}

export async function expectNoHorizontalDocumentOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

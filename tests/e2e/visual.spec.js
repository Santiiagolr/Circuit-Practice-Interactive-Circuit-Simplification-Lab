import { expect, test } from '@playwright/test';

test('workbench visual baseline', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'tablet', 'iphone-13'].includes(testInfo.project.name));
  await page.goto('/?seed=2026&mode=advanced&type=R&difficulty=challenge&values=varied');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.circuit-panel')).toHaveScreenshot(`workbench-${testInfo.project.name}.png`, {
    animations: 'disabled',
  });
});

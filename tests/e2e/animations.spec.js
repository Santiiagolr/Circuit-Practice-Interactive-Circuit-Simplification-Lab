import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { captureRuntimeErrors, expectNoHorizontalDocumentOverflow, findManualMove, performManualMove, solveVisibleCircuit } from './helpers.js';

test('R C and both L symbols reward accepted reductions and never replay them on reload', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  for (const [type, representation, style] of [['R', 'numeric'], ['C', 'symbolic'], ['L', 'numeric', 'schematic'], ['L', 'symbolic', 'copper']]) {
    await page.goto(`/?seed=72&type=${type}&representation=${representation}&difficulty=guided`);
    if (style === 'copper') {
      await page.getByText('Configurar práctica').click();
      await page.getByLabel('Estilo de inductor').selectOption(style);
    }
    const initialCount = await page.locator('[data-component-id]').count();
    const scoreBefore = Number(await page.getByTestId('score').textContent());
    const streakBefore = Number((await page.getByTestId('step-streak').getAttribute('aria-label')).match(/^\d+/)[0]);
    await performManualMove(page, await findManualMove(page));
    const remaining = await page.locator('[data-component-id]').count();
    await expect(page.getByTestId('score')).toHaveText(String(scoreBefore + initialCount - remaining));
    await expect(page.getByTestId('step-streak')).toHaveAttribute('aria-label', `${streakBefore + 1} reducciones correctas consecutivas`);
    await expectNoHorizontalDocumentOverflow(page);
    const card = await page.getByTestId('step-streak').boundingBox();
    const segments = await page.locator('.streak-segments').boundingBox();
    expect(segments.x + segments.width).toBeLessThanOrEqual(card.x + card.width - 2);
    const score = await page.getByTestId('score').textContent();
    await page.reload();
    await expect(page.getByTestId('score')).toHaveText(score);
    await expect(page.getByTestId('reduction-overlay')).toHaveCount(0);
    await expect(page.locator('.score-feedback__gain')).toHaveCount(0);
    await expect(page.locator('.streak-milestone-rays')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('reduced motion stays complete and also takes effect during a running action', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=74&type=L&difficulty=guided');
  await performManualMove(page, await findManualMove(page));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('reduction-overlay')).toHaveCount(0);
  await solveVisibleCircuit(page);
  const stepScore = Number(await page.getByTestId('score').textContent());
  await page.getByRole('button', { name: 'Entregar resultado' }).click();
  await expect(page.getByTestId('completion')).toContainText('¡Circuito resuelto!');
  await expect(page.locator('.completion-particle')).toHaveCount(0);
  await expect(page.getByTestId('score')).toHaveText(String(stepScore + 10));
  await expectNoHorizontalDocumentOverflow(page);
  expect(errors).toEqual([]);
});

test('completion feedback survives exam auto-next and the last exercise without delaying either', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=76&type=R&mode=exam');
  await page.getByText('Configurar práctica').click();
  await page.getByLabel('Ejercicios del parcial').selectOption('3');
  await page.getByRole('button', { name: 'Comenzar parcial' }).click();
  for (let index = 0; index < 3; index++) {
    await solveVisibleCircuit(page);
    await page.getByRole('button', { name: 'Entregar y continuar' }).click();
    await expect(page.locator('.exam-completion-toast')).toContainText('¡Circuito resuelto!');
    await expect(page.locator('.exam-completion-toast')).toContainText('Racha de pasos:');
    if (index < 2) await expect(page.getByRole('heading', { name: new RegExp(`Parcial · ${index + 2}/3`) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Parcial entregado' })).toBeVisible();
  await expect(page.locator('.workbench')).toHaveCount(0);
  await expect(page.locator('.exam-completion-toast')).toHaveCount(1);
  await expect(page.locator('.exam-completion-toast')).toHaveCount(0, { timeout: 3000 });
  expect(errors).toEqual([]);
});

test('does not replay completion effects when reduced motion is enabled and disabled', async ({ page }) => {
  for (const source of ['workbench', 'exam']) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`/?seed=79&type=L&mode=${source === 'exam' ? 'exam' : 'training'}`);
    if (source === 'exam') await page.getByRole('button', { name: 'Comenzar parcial' }).click();
    await solveVisibleCircuit(page);
    await page.getByRole('button', { name: /^Entregar/ }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(60);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(60);
    const animation = await page.locator(source === 'exam' ? '.exam-completion-toast' : '.result-strip').evaluate((element, source) => getComputedStyle(element, source === 'exam' ? null : '::after').animationName, source);
    expect(animation).toBe('none');
  }
});

test('captures real animation phases with a controlled clock and paused browser animations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  const directory = 'output/playwright/animations';
  await mkdir(directory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') });
  await page.goto('/?seed=814&type=L&difficulty=guided&values=equal');
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date('2026-10-29T12:01:00Z'));
  const move = await findManualMove(page);
  for (const id of move.ids) await page.getByTestId(`component-${id}`).evaluate(button => button.click());
  await page.getByRole('button', { name: move.rule === 'series' ? /^Serie/ : /^Paralelo/ }).evaluate(button => button.click());
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.pause()));
  for (const [delta, time] of [[120, 120], [200, 320], [180, 500], [120, 620]]) {
    await page.clock.runFor(delta);
    await page.evaluate(time => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; }), time);
    await page.screenshot({ path: `${directory}/reduction-${time}.png`, animations: 'allow' });
  }
  await expect(page.getByTestId('reduction-overlay')).toHaveCount(0);
  await expect(page.locator('.score-feedback__visual')).toHaveText(await page.getByTestId('score').textContent());
  await page.clock.resume();
  await solveVisibleCircuit(page);
  const timestamp = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(timestamp + 1000);
  await page.getByRole('button', { name: 'Entregar resultado' }).evaluate(button => button.click());
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.pause()));
  for (const [delta, time] of [[120, 120], [200, 320], [180, 500], [200, 700]]) {
    await page.clock.runFor(delta);
    await page.evaluate(time => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; }), time);
    await page.screenshot({ path: `${directory}/complete-${time}.png`, fullPage: true, animations: 'allow' });
  }
  await page.screenshot({ path: `${directory}/complete-light.png`, fullPage: true, animations: 'allow' });
  await page.clock.resume();
  await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
  await page.screenshot({ path: `${directory}/complete-dark.png`, fullPage: true });
});

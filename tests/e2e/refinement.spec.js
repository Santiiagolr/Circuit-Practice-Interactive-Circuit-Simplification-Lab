import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { applyPracticeSettings, captureRuntimeErrors, expectNoHorizontalDocumentOverflow, findManualMove, openComponentPanel, selectComponents, solveVisibleCircuit } from './helpers';

const session = page => page.evaluate(() => JSON.parse(localStorage.getItem('circuit-practice:session:v2')));

test('withholds history explanations and replay until the active exam is finished', async ({ page }) => {
  await page.goto('/?seed=301&mode=exam&type=R');
  await page.getByRole('button', { name: 'Comenzar parcial' }).click();
  await solveVisibleCircuit(page);
  await page.getByRole('button', { name: 'Entregar y continuar' }).click();
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await page.locator('.history-entry > summary').first().click();
  await expect(page.getByRole('region', { name: 'Historial de ejercicios' })).toContainText('La revisión se habilita al finalizar el parcial');
  await expect(page.locator('.history-section .formula-explanation')).toHaveCount(0);
  await expect(page.getByText('Recorrido gráfico paso a paso', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Elegir un tema' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Volver al ejercicio' }).click();
  await page.getByRole('button', { name: 'Finalizar parcial', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finalizar parcial' }).click();
  await page.locator('.history-entry > summary').filter({ hasText: ' · Entregado' }).first().click();
  await expect(page.getByText('Intentos y explicaciones', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();
  await page.getByRole('button', { name: 'Volver al ejercicio' }).click();
  await expect(page.getByRole('heading', { name: 'Parcial cerrado' })).toBeVisible();
});

test('configuration drafts apply once and abandonment can be cancelled without losing work', async ({ page }) => {
  await page.goto('/?seed=301&type=R');
  await openComponentPanel(page);
  await page.getByRole('button', { name: 'Pista conceptual' }).click();
  const before = await session(page);
  await page.getByText('Configurar práctica', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Componentes', exact: true }).selectOption('L');
  await page.getByRole('combobox', { name: 'Dificultad', exact: true }).selectOption('challenge');
  expect((await session(page)).current.exercise.id).toBe(before.current.exercise.id);
  await page.getByRole('button', { name: 'Aplicar y comenzar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar practicando' }).click();
  await expect(page.getByRole('button', { name: 'Aplicar y comenzar' })).toBeFocused();
  expect((await session(page)).current.exercise.id).toBe(before.current.exercise.id);
  await page.getByRole('button', { name: 'Aplicar y comenzar' }).click();
  await page.getByRole('button', { name: 'Abandonar y continuar' }).click();
  const after = await session(page);
  expect(after.settings).toMatchObject({ compType: 'L', difficulty: 'challenge' });
  expect(after.history.filter(item => item.id === before.current.exercise.id)).toHaveLength(1);
  await expect(page.locator('.exercise-heading')).toContainText('Inductores');
});

test('manual input survives navigation and reload, and distinguishes invalid format from a wrong value', async ({ page }) => {
  await page.goto('/?seed=378&type=C&values=equal&manual=true');
  const move = await findManualMove(page);
  await selectComponents(page, move.ids);
  await page.getByRole('button', { name: move.rule === 'series' ? /^Serie/ : /^Paralelo/ }).click();
  const input = page.getByLabel(/Equivalente en/);
  await input.fill('abc');
  await page.getByRole('button', { name: 'Confirmar valor' }).click();
  await expect(page.locator('#answer-notice')).toContainText('Formato inválido');
  const original = await session(page);
  expect(original.current.attempts.filter(item => item.kind === 'error')).toHaveLength(0);
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();
  await page.keyboard.press('q');
  await page.getByRole('button', { name: 'Volver al ejercicio' }).click();
  await expect(input).toHaveValue('abc');
  await page.reload();
  await expect(input).toHaveValue('abc');
  await input.fill('999999');
  await page.getByRole('button', { name: 'Confirmar valor' }).click();
  await expect(page.locator('#answer-notice')).toContainText('Valor incorrecto');
  await expect(input).toHaveValue('999999');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  expect((await session(page)).current.attempts.filter(item => item.kind === 'error')).toHaveLength(1);
});

test('concentration and component panel preserve selection and zoom; help traps focus and blocks shortcuts', async ({ page }) => {
  await page.goto('/?seed=301&type=R');
  const move = await findManualMove(page);
  await selectComponents(page, move.ids);
  await page.getByRole('button', { name: 'Acercar circuito' }).click();
  await page.getByRole('button', { name: 'Concentración', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Secciones principales' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Concentración', exact: true })).toBeFocused();
  // Escape clears selection using the established circuit shortcut.
  await expect(page.getByText('150%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  const before = await session(page);
  await page.keyboard.press('q');
  await page.keyboard.press('Control+z');
  expect((await session(page)).current).toEqual(before.current);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cerrar ayuda' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Ayuda', exact: true })).toBeFocused();
});

test('a timed exam continues during navigation, permits appearance changes and closes through an accessible dialog', async ({ page }) => {
  await page.goto('/?seed=301&mode=exam&type=L');
  await page.getByText('Configurar práctica', { exact: true }).click();
  await page.getByLabel('Tiempo límite').selectOption('15');
  await applyPracticeSettings(page);
  await page.getByRole('button', { name: 'Comenzar parcial' }).click();
  const started = await session(page);
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await session(page)).exam.deadline).toBe(started.exam.deadline);
  await expect(page.locator('.exam-clock')).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar parcial', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('incompletos');
  await page.getByRole('button', { name: 'Continuar practicando' }).click();
  expect((await session(page)).exam.status).toBe('active');
  await page.getByRole('button', { name: 'Finalizar parcial', exact: true }).click();
  await dialog.getByRole('button', { name: 'Finalizar parcial' }).click();
  await expect(page.getByRole('heading', { name: 'Parcial cerrado' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Historial de ejercicios' })).toBeVisible();
});

test('all views and dialogs remain accessible in both themes and at browser zoom', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=301&type=L');
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
    for (const view of ['Por temas', 'Progreso', 'Historial']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await expectNoHorizontalDocumentOverflow(page);
      const audit = await new AxeBuilder({ page }).analyze();
      expect(audit.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([]);
    }
    await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations.filter(item => ['critical', 'serious'].includes(item.impact))).toEqual([]);
    await page.keyboard.press('Escape');
  }
  // A 1280px browser at 200% exposes a 640px layout viewport; text remains at its CSS size.
  await page.setViewportSize({ width: 640, height: 450 });
  await page.getByRole('button', { name: 'Volver al ejercicio' }).click();
  await expectNoHorizontalDocumentOverflow(page);
  await expect(page.getByRole('button', { name: /^Serie/ })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('records reviewable visual evidence of all five areas across the responsive matrix', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  test.setTimeout(120_000);
  await page.goto('/');
  for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [844, 390], [1280, 900], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?seed=416&type=L&difficulty=challenge');
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
      for (const [view, label] of [['bench', 'Práctica libre'], ['topics', 'Por temas'], ['progress', 'Progreso'], ['history', 'Historial'], ['exam', 'Parcial']]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.evaluate(() => document.fonts.ready);
        await expectNoHorizontalDocumentOverflow(page);
        await page.screenshot({ path: `output/playwright/refinement/${width}-${theme}-${view}.png`, fullPage: true, animations: 'disabled' });
      }
    }
  }
});

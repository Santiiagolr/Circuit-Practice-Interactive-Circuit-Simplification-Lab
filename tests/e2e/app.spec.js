import { expect, test } from '@playwright/test';
import { captureRuntimeErrors, expectNoHorizontalDocumentOverflow, findManualMove, performManualMove, selectComponents, solveVisibleCircuit, visibleLabelOverlaps } from './helpers';

test('opens the complete circuit at desktop and supports fit and fullscreen', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=120&difficulty=challenge&type=R');
  await expect(page.getByRole('heading', { name: /Entrenamiento/ })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Acciones del circuito' })).toBeVisible();
  await expect(page.locator('svg[data-testid="circuit"]')).toBeVisible();
  await expectNoHorizontalDocumentOverflow(page);
  await page.getByRole('button', { name: 'Acercar circuito' }).click();
  await expect(page.getByText('150%')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar' }).click();
  await page.getByRole('button', { name: 'Pantalla completa' }).click();
  await expect(page.locator('.workbench')).toHaveClass(/desk-fullscreen/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.workbench')).not.toHaveClass(/desk-fullscreen/);
  expect(errors).toEqual([]);
});

test('switches and remembers the laboratory light and dark themes', async ({ page }) => {
  await page.goto('/?seed=120');
  const app = page.locator('.practice-app');
  await expect(app).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
  await expect(app).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(app).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Usar tema claro' }).click();
  await expect(app).toHaveAttribute('data-theme', 'light');
});

test('keeps a delivered circuit visible, replays its verified steps and allows a no-reward repeat', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/?seed=831&type=C&difficulty=guided');
  await solveVisibleCircuit(page);
  await page.getByRole('button', { name: 'Entregar resultado' }).click();
  await expect(page.getByRole('region', { name: 'Circuito reducido' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente ejercicio' })).toBeVisible();
  const score = await page.getByTestId('score').textContent();
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.locator('.history-entry > summary').first().click();
  await page.getByText('Recorrido gráfico paso a paso').click();
  await expect(page.getByText(/Paso 0 de/)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText(/Paso 1 de/)).toBeVisible();
  await page.getByRole('button', { name: 'Por temas' }).click();
  await page.getByRole('button', { name: 'Empezar tema' }).first().click();
  await page.getByRole('button', { name: 'Repetir sin puntos' }).click();
  await expect(page.locator('.workbench')).toBeVisible();
  await expect(page.locator('.topics-page')).toHaveCount(0);
  await expect(page.getByTestId('score')).toHaveText(score);
  await solveVisibleCircuit(page);
  await page.getByRole('button', { name: 'Entregar resultado' }).click();
  await expect(page.getByTestId('score')).toHaveText(score);
});

test('runs the continuous topic cycle and preserves topic progress on reload', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=621&type=R&difficulty=guided');
  await page.getByRole('button', { name: 'Por temas' }).click();
  await page.getByRole('button', { name: 'Empezar tema' }).first().click();
  await expect(page.getByText('Diagnóstico 1 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, cumplen la regla' }).click();
  await expect(page.locator('.mini-feedback')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente mini ejercicio' }).click();
  await expect(page.getByText('Diagnóstico 2 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'No, hay otra conexión' }).click();
  await page.getByRole('button', { name: 'Continuar al circuito completo' }).click();
  await expect(page.locator('.exercise-heading')).toContainText('Tema · R · Serie');
  expect(await page.locator('svg [data-component-id]').count()).toBeGreaterThanOrEqual(4);
  await solveVisibleCircuit(page);
  await page.getByRole('button', { name: 'Entregar resultado' }).click();
  await expect(page.getByRole('button', { name: 'Siguiente ejercicio' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente ejercicio' }).click();
  await expect(page.getByText('Diagnóstico 1 / 2')).toBeVisible();
  await page.reload();
  await expect(page.locator('.topics-page')).toBeVisible();
  await page.getByRole('button', { name: 'Progreso' }).click();
  await expect(page.locator('.progress-page')).toContainText('1 circuito del tema');
  await expectNoHorizontalDocumentOverflow(page);
  expect(errors).toEqual([]);
});

test('selects through a physical SVG click and the accessible component panel', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=301&difficulty=guided&type=R');
  const component = page.locator('svg [data-component-id]').first();
  await component.locator('[data-component-hitbox]').click();
  await expect(component).toHaveAttribute('aria-pressed', 'true');
  const selectedId = await component.getAttribute('data-component-id');
  await expect(page.getByTestId(`component-${selectedId}`)).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('reduces a chain of five resistors and capacitors with Q, then undoes and redoes', async ({ page }) => {
  test.setTimeout(40_000);
  const errors = captureRuntimeErrors(page);
  for (const type of ['R', 'C']) {
    await page.goto(`/?seed=378&difficulty=guided&type=${type}&values=equal`);
    const move = await findManualMove(page);
    expect(move.rule).toBe('series'); expect(move.ids.length).toBeGreaterThanOrEqual(4);
    const count = await page.locator('svg [data-component-id]').count();
    await performManualMove(page, move);
    await expect(page.locator('svg [data-component-id]')).toHaveCount(count - move.ids.length + 1);
    await page.keyboard.press('Control+z');
    await expect(page.locator('svg [data-component-id]')).toHaveCount(count);
    await page.keyboard.press('Control+y');
    await expect(page.locator('svg [data-component-id]')).toHaveCount(count - move.ids.length + 1);
  }
  expect(errors).toEqual([]);
});

test('manual numeric entry rejects a wrong value, keeps the circuit and permits a correct retry', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=378&difficulty=guided&type=R&values=equal&manual=true');
  const move = await findManualMove(page), count = await page.locator('svg [data-component-id]').count();
  await selectComponents(page, move.ids);
  await page.keyboard.press(move.rule === 'series' ? 'q' : 'e');
  await page.getByLabel(/Equivalente en/).fill('999');
  await page.getByRole('button', { name: 'Confirmar valor' }).click();
  await expect(page.getByText(/El valor no coincide/)).toBeVisible();
  await expect(page.locator('svg [data-component-id]')).toHaveCount(count);
  await page.getByLabel(/Equivalente en/).fill(move.rule === 'series' ? String(move.ids.length * 20) : String(20 / move.ids.length));
  await page.getByRole('button', { name: 'Confirmar valor' }).click();
  await expect(page.locator('svg [data-component-id]')).toHaveCount(count - move.ids.length + 1);
  await expect(page.getByTestId('steps')).toHaveText('1');
  await page.getByRole('button', { name: 'Historial' }).click();
  expect(errors).toEqual([]);
});

test('capacitor settings and an unfinished timed exam survive page reload', async ({ page }) => {
  await page.goto('/?seed=78&difficulty=practice&type=C&representation=symbolic');
  await expect(page.locator('.component-panel')).toContainText('C');
  await page.reload();
  await expect(page.locator('.component-panel')).toContainText('C');
  await page.getByText('Configurar práctica').click();
  await page.getByLabel('Modalidad').selectOption('exam');
  await page.getByLabel('Ejercicios del parcial').selectOption('3');
  await page.getByLabel('Tiempo límite').selectOption('15');
  await page.getByRole('button', { name: 'Comenzar parcial' }).click();
  await expect(page.getByRole('button', { name: 'Pista conceptual' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Parcial · 1\/3/)).toBeVisible();
  await expect(page.locator('.exam-clock')).toBeVisible();
});

test('physical touch controls complete an exercise on mobile without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(!['pixel-7', 'iphone-13', 'tablet', 'mobile-landscape'].includes(testInfo.project.name));
  test.setTimeout(60_000);
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=301&difficulty=guided&type=C');
  await expectNoHorizontalDocumentOverflow(page);
  await expect(page.locator('.component-panel')).toBeVisible();
  for (const button of await page.locator('.component-option').all()) {
    const box = await button.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await solveVisibleCircuit(page, true);
  await page.getByRole('button', { name: 'Entregar resultado' }).click();
  await expect(page.getByTestId('score')).toHaveText('10');
  expect(errors).toEqual([]);
});

test('physical touch removes an open switch from a dense mobile challenge', async ({ page }, testInfo) => {
  test.skip(!['pixel-7', 'iphone-13', 'tablet', 'mobile-landscape'].includes(testInfo.project.name));
  const errors = captureRuntimeErrors(page);
  await page.goto('/?seed=2&difficulty=challenge&type=R');
  const switchComponent = page.locator('svg [data-component-id][aria-label*="Interruptor"][aria-label*="Abierto"]').first();
  await expect(switchComponent).toBeVisible();
  const id = await switchComponent.getAttribute('data-component-id');
  const before = await page.locator('svg [data-component-id]').count();
  await selectComponents(page, [id], true);
  const remove = page.getByRole('button', { name: 'Eliminar abierto' });
  const box = await remove.boundingBox(), viewport = page.viewportSize();
  expect(box).not.toBeNull(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(switchComponent).toHaveCount(0);
  expect(await page.locator('svg [data-component-id]').count()).toBeLessThan(before);
  expect(errors).toEqual([]);
});

test('a three-question exam records one delivery and leaves a review', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/?seed=82&difficulty=guided&type=R');
  await page.getByText('Configurar práctica').click();
  await page.getByLabel('Modalidad').selectOption('exam');
  await page.getByLabel('Ejercicios del parcial').selectOption('3');
  await page.getByRole('button', { name: 'Comenzar parcial' }).click();
  await solveVisibleCircuit(page);
  await page.getByRole('button', { name: 'Entregar y continuar' }).click();
  await expect(page.getByTestId('score')).toHaveText('10');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Finalizar parcial' }).click();
  await expect(page.getByRole('heading', { name: 'Parcial cerrado' })).toBeVisible();
  await expect(page.locator('.exam-summary')).toContainText('1 de 3 ejercicios completos');
  await expect(page.locator('.history-section')).toContainText('Incompleto');
});

test('completes every component and difficulty combination through the visible controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  test.setTimeout(120_000);
  const errors = captureRuntimeErrors(page);
  let seed = 920;
  for (const type of ['R', 'C']) for (const difficulty of ['guided', 'practice', 'challenge']) {
    await page.goto(`/?seed=${seed++}&difficulty=${difficulty}&type=${type}`);
    await solveVisibleCircuit(page);
    await expect(page.getByRole('region', { name: 'Circuito reducido' })).toBeVisible();
    await expectNoHorizontalDocumentOverflow(page);
    await page.getByRole('button', { name: 'Entregar resultado' }).click();
    await expect(page.getByTestId('score')).not.toHaveText('0');
    await page.evaluate(() => document.fonts.ready);
  }
  expect(errors).toEqual([]);
});

test('accepts an exact symbolic fraction after a manual capacitor reduction', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/?seed=378&difficulty=guided&type=C&values=equal&representation=symbolic&manual=true');
  const move = await findManualMove(page);
  expect(move.rule).toBe('series');
  await selectComponents(page, move.ids);
  await page.keyboard.press('q');
  await page.getByLabel(/Equivalente en/).fill(`2/${move.ids.length}C`);
  await page.getByRole('button', { name: 'Confirmar valor' }).click();
  await expect(page.getByTestId('steps')).toHaveText('1');
  await expect(page.locator('.feedback-strip.success')).toBeVisible();
});

test('dense overview keeps readable IDs and large SVG targets while offering detail and ambiguity choices', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'iphone-13', 'mobile-landscape'].includes(testInfo.project.name));
  await page.goto('/?seed=416&difficulty=challenge&type=R');
  await expect(page.locator('svg [data-component-id]')).toHaveCount(15);
  await expect.poll(async () => page.locator('svg[data-testid="circuit"]').evaluate(svg => {
    const labels = [...svg.querySelectorAll('.component-id')];
    const scale = svg.getScreenCTM().a;
    return labels.length ? Math.min(...labels.map(label => parseFloat(getComputedStyle(label).fontSize) * scale)) : 0;
  })).toBeGreaterThanOrEqual(10.9);
  const metrics = await page.locator('svg[data-testid="circuit"]').evaluate(svg => {
    const hitboxes = [...svg.querySelectorAll('[data-component-hitbox]')].map(hitbox => hitbox.getBoundingClientRect());
    return { ids: svg.querySelectorAll('.component-id').length, values: svg.querySelectorAll('.component-value').length, width: Math.min(...hitboxes.map(box => box.width)), height: Math.min(...hitboxes.map(box => box.height)) };
  });
  expect(metrics.ids).toBeGreaterThan(0);
  expect(metrics.values).toBe(0);
  expect(metrics.width).toBeGreaterThanOrEqual(43.5);
  expect(metrics.height).toBeGreaterThanOrEqual(43.5);
  expect(await visibleLabelOverlaps(page)).toEqual([]);
  await expect(page.locator('.component-panel')).toContainText('R15');
  await expectNoHorizontalDocumentOverflow(page);
  if (testInfo.project.name === 'mobile-landscape') {
    const component = page.locator('svg [data-component-id]').first();
    const hitbox = component.locator('[data-component-hitbox]');
    await hitbox.scrollIntoViewIfNeeded();
    const proximity = await component.evaluate(target => {
      const svg = target.ownerSVGElement, matrix = svg.getScreenCTM();
      const centers = [...svg.querySelectorAll('[data-component-id]')].map(item => {
        const match = item.querySelector(':scope > g').getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)/);
        const point = new DOMPoint(Number(match[1]), Number(match[2])).matrixTransform(matrix);
        return { id: item.dataset.componentId, x: point.x, y: point.y };
      });
      const selected = centers.find(center => center.id === target.dataset.componentId);
      return { count: centers.filter(center => Math.hypot(center.x - selected.x, center.y - selected.y) < 36).length, label: target.getAttribute('aria-label').match(/\b[A-Z]\d+\b/)?.[0] };
    });
    const box = await hitbox.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const picker = page.getByRole('group', { name: 'Componentes cercanos' });
    if (proximity.count > 1) {
      await expect(picker).toBeVisible();
      await picker.getByRole('button', { name: new RegExp(`^${proximity.label} `) }).click();
    } else await expect(component).toHaveAttribute('aria-pressed', 'true');
  }
});

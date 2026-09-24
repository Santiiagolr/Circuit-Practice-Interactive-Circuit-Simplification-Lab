import { expect } from '@playwright/test';

export function captureRuntimeErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));
  return errors;
}
export async function expectNoHorizontalDocumentOverflow(page) {
  const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
}
export async function visibleLabelOverlaps(page) {
  return page.locator('svg[data-testid="circuit"]').evaluate(svg => {
    const labels = [...svg.querySelectorAll('.component-id, .component-value')].filter(item => getComputedStyle(item).display !== 'none');
    const symbols = [...svg.querySelectorAll('.electrical-symbol')];
    const intersects = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const overlaps = [];
    for (let i = 0; i < labels.length; i++) {
      const box = labels[i].getBoundingClientRect();
      for (let j = i + 1; j < labels.length; j++) if (intersects(box, labels[j].getBoundingClientRect())) overlaps.push([labels[i].textContent, labels[j].textContent]);
      for (const symbol of symbols) if (intersects(box, symbol.getBoundingClientRect())) overlaps.push([labels[i].textContent, symbol.closest('[data-component-id]')?.dataset.componentId]);
    }
    return overlaps;
  });
}
function degrees(edges) {
  const map = new Map();
  for (const edge of edges) for (const node of [edge.from, edge.to]) map.set(node, (map.get(node) || 0) + 1);
  return map;
}
function longestSeries(edges) {
  const degree = degrees(edges); let best = [];
  function extend(path) {
    if (path.length > best.length) best = path;
    for (const endpoint of [path[0].from, path.at(-1).to]) {
      if (endpoint === 'A' || endpoint === 'B' || degree.get(endpoint) !== 2) continue;
      const edge = edges.find(item => (item.from === endpoint || item.to === endpoint) && !path.some(old => old.id === item.id));
      if (edge) extend(path[0].from === endpoint ? [edge, ...path] : [...path, edge]);
    }
  }
  for (const edge of edges) extend([edge]);
  if (best.length > 1) {
    const start = best.find(edge => degrees(best).get(edge.from) === 1)?.from ?? best[0].from;
    const result = [], seen = new Set(); let node = start;
    while (result.length < best.length) {
      const edge = best.find(item => !seen.has(item.id) && (item.from === node || item.to === node));
      if (!edge) break;
      seen.add(edge.id); result.push(edge); node = edge.from === node ? edge.to : edge.from;
    }
    best = result;
  }
  return best;
}
export async function findManualMove(page) {
  const edges = await page.locator('svg [data-component-id]').evaluateAll(items => items.map(item => ({ id: item.dataset.componentId, from: item.dataset.from, to: item.dataset.to, open: item.getAttribute('aria-label')?.includes('Abierto') })));
  const open = edges.find(edge => edge.open);
  if (open) return { ids: [open.id], rule: 'delete' };
  const parallel = new Map();
  for (const edge of edges) { const key = [edge.from, edge.to].sort().join('::'); parallel.set(key, [...(parallel.get(key) || []), edge]); }
  const group = [...parallel.values()].find(items => items.length > 1);
  if (group) return { ids: group.map(edge => edge.id), rule: 'parallel' };
  const series = longestSeries(edges);
  if (series.length > 1) return { ids: series.map(edge => edge.id), rule: 'series' };
  throw new Error('The visible circuit should always offer a manual move.');
}
export async function selectComponents(page, ids, touch = false) {
  for (const id of ids) {
    const button = page.getByTestId(`component-${id}`);
    await button.scrollIntoViewIfNeeded();
    if (touch) { const box = await button.boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
    else await button.click();
  }
}
export async function performManualMove(page, move, touch = false) {
  if (move.rule === 'delete') {
    await selectComponents(page, move.ids, touch);
    const button = page.getByRole('button', { name: 'Eliminar abierto' });
    if (touch) {
      const box = await button.boundingBox(), viewport = page.viewportSize();
      expect(box).not.toBeNull(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
    else await button.click();
    return;
  }
  await selectComponents(page, move.ids, touch);
  if (touch) {
    const button = page.getByRole('button', { name: move.rule === 'series' ? /^Serie/ : /^Paralelo/ });
    const box = await button.boundingBox(), viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else await page.keyboard.press(move.rule === 'series' ? 'q' : 'e');
}
export async function solveVisibleCircuit(page, touch = false, max = 80) {
  for (let step = 0; step < max; step++) {
    if (await page.getByRole('button', { name: 'Entregar y continuar' }).count()) return;
    const before = await page.locator('svg [data-component-id]').count();
    await performManualMove(page, await findManualMove(page), touch);
    await expect.poll(() => page.locator('svg [data-component-id]').count()).toBeLessThan(before);
  }
  throw new Error('Circuit did not reach its single equivalent.');
}

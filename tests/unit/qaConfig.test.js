import { expect, it } from 'vitest';
import { parseQaConfig } from '../../src/lib/qaConfig';

it('accepts reproducible QA parameters only when enabled', () => {
  const search = '?seed=42&mode=exam&type=c&difficulty=challenge&values=equal';
  expect(parseQaConfig(search, false, 7)).toMatchObject({ enabled: false, seed: 7, mode: 'training' });
  expect(parseQaConfig(search, true, 7)).toEqual({
    enabled: true, seed: 42, mode: 'exam', compType: 'C', difficulty: 'challenge', valueMode: 'equal', representation: 'numeric', manual: false,
    explicit: true, key: JSON.stringify({ seed: 42, mode: 'exam', compType: 'C', difficulty: 'challenge', valueMode: 'equal', representation: 'numeric', manual: false }),
  });
});

it('rejects invalid enums and unsafe seeds', () => {
  expect(parseQaConfig('?seed=-1&mode=auto&type=X&difficulty=impossible', true, 9)).toEqual({
    enabled: true, seed: 9, mode: 'training', compType: 'R', difficulty: 'guided', valueMode: 'varied', representation: 'numeric', manual: false,
    explicit: true, key: JSON.stringify({ seed: 9, mode: 'training', compType: 'R', difficulty: 'guided', valueMode: 'varied', representation: 'numeric', manual: false }),
  });
});

it('never interprets missing or empty seed as zero, but supports explicit zero', () => {
  for (const search of ['', '?seed=', '?seed=%20']) expect(parseQaConfig(search, true, 777).seed).toBe(777);
  expect(parseQaConfig('?seed=0', true, 777).seed).toBe(0);
});

it('marks only explicit QA query parameters as reproducible overrides', () => {
  expect(parseQaConfig('', true, 777).explicit).toBe(false);
  expect(parseQaConfig('?mode=exam', true, 777).explicit).toBe(true);
});

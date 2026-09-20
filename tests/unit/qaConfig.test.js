import { expect, it } from 'vitest';
import { parseQaConfig } from '../../src/lib/qaConfig';

it('accepts reproducible QA parameters only when enabled', () => {
  const search = '?seed=42&mode=advanced&type=c&difficulty=challenge&values=equal';
  expect(parseQaConfig(search, false, 7)).toMatchObject({ enabled: false, seed: 7, mode: 'basic' });
  expect(parseQaConfig(search, true, 7)).toEqual({
    enabled: true, seed: 42, mode: 'advanced', compType: 'C', difficulty: 'challenge', valueMode: 'equal',
  });
});

it('rejects invalid enums and unsafe seeds', () => {
  expect(parseQaConfig('?seed=-1&mode=solver&type=X&difficulty=impossible', true, 9)).toEqual({
    enabled: true, seed: 9, mode: 'basic', compType: 'R', difficulty: 'guided', valueMode: 'varied',
  });
});

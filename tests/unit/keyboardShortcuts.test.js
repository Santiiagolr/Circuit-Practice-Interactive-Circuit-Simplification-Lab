import { describe, expect, it } from 'vitest';
import { getReductionAction } from '../../src/lib/keyboardShortcuts';

describe('reduction keyboard shortcuts', () => {
  it.each([
    [{ code: 'KeyQ', key: 'q' }, 'series'],
    [{ code: 'KeyQ', key: 'Q' }, 'series'],
    [{ code: 'KeyE', key: 'e' }, 'parallel'],
    [{ code: 'KeyE', key: 'E' }, 'parallel'],
    [{ code: '', key: 'q' }, 'series'],
    [{ code: '', key: 'E' }, 'parallel'],
  ])('maps %o to %s regardless of keyboard casing', (event, expected) => {
    expect(getReductionAction(event)).toBe(expected);
  });

  it('does not hijack unrelated or modified shortcuts', () => {
    expect(getReductionAction({ code: 'KeyR', key: 'r' })).toBeNull();
    expect(getReductionAction({ code: 'Space', key: ' ' })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyReward,
  calculateReward,
  INITIAL_INTERACTION_STATE,
  interactionReducer,
  normalizeProgress,
  readProgress,
  writeProgress,
} from '../../src/lib/gameState';

describe('progress persistence and scoring', () => {
  it('normalizes corrupt or hostile values', () => {
    expect(normalizeProgress({ score: -4, streak: '3.8', completed: Infinity })).toEqual({
      score: 0, streak: 3, bestStreak: 0, completed: 0,
    });
    expect(readProgress({ getItem: () => '{bad json' })).toEqual({ score: 0, streak: 0, bestStreak: 0, completed: 0 });
  });

  it('does not crash when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readProgress(blocked)).toEqual({ score: 0, streak: 0, bestStreak: 0, completed: 0 });
    expect(writeProgress({ score: 10 }, blocked)).toBe(false);
  });

  it('awards streak bonuses only to clean exercises', () => {
    const clean = calculateReward({ streak: 3 }, 'challenge', false);
    expect(clean).toEqual({ points: 50, streak: 4, clean: true });
    expect(applyReward({ score: 5, streak: 3, bestStreak: 3, completed: 1 }, clean)).toEqual({
      score: 55, streak: 4, bestStreak: 4, completed: 2,
    });
    expect(calculateReward({ streak: 8 }, 'practice', true)).toEqual({ points: 20, streak: 0, clean: false });
  });
});

it('keeps selection, errors, steps and resets deterministic', () => {
  let state = interactionReducer(INITIAL_INTERACTION_STATE, { type: 'toggle-selection', id: 'a' });
  state = interactionReducer(state, { type: 'toggle-selection', id: 'b' });
  expect(state.selectedIds).toEqual(['a', 'b']);
  state = interactionReducer(state, { type: 'error', feedback: { type: 'error' } });
  expect(state.mistakes).toBe(1);
  expect(state.exerciseHadMistake).toBe(true);
  state = interactionReducer(state, { type: 'step' });
  expect(state.steps).toBe(1);
  expect(state.selectedIds).toEqual([]);
  expect(interactionReducer(state, { type: 'reset' })).toEqual(INITIAL_INTERACTION_STATE);
});

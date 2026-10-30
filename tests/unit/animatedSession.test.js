import { expect, it } from 'vitest';
import { createSession, saveSession, SESSION_KEY } from '../../src/lib/session.js';
import { animatedSessionReducer } from '../../src/lib/useAnimatedSession.js';
import { nextMove } from '../helpers/manualMoves.js';

function initial(stepStreak = 0) {
  return { session: createSession({ seed: 72, progress: { stepStreak }, now: 0 }), feedback: { geometry: null, score: null, streak: null, completion: null } };
}
function reduce(wrapper, at = 1000) {
  const move = nextMove(wrapper.session.current.exercise);
  for (const id of move.ids) wrapper = animatedSessionReducer(wrapper, { type: 'select', id, now: at, eventId: `select-${id}` });
  return animatedSessionReducer(wrapper, { type: 'reduce', rule: move.rule, now: at, eventId: `reduce-${at}` });
}

it('updates canonical points immediately, coalesces rapid gains, and cancels only stale geometry on selection', () => {
  let wrapper = reduce(initial());
  expect(wrapper.session.progress.score).toBeGreaterThan(0);
  expect(wrapper.feedback.score).toMatchObject({ delay: 120, duration: 500 });
  const first = wrapper.session.progress.score;
  wrapper = reduce(wrapper, 1100);
  expect(wrapper.feedback.score.amount).toBe(wrapper.session.progress.score);
  expect(wrapper.feedback.score.duration).toBe(320);
  expect(wrapper.session.progress.score).toBeGreaterThan(first);
  const score = wrapper.feedback.score;
  wrapper = animatedSessionReducer(wrapper, { type: 'undo', now: 1150, eventId: 'undo' });
  expect(wrapper.feedback.geometry).toBeNull();
  expect(wrapper.feedback.score).toBe(score);
});

it('celebrates only newly reached milestones and keeps transient feedback out of saved sessions', () => {
  for (const count of [3, 5, 10, 20]) {
    const wrapper = reduce(initial(count - 1));
    expect(wrapper.feedback.streak).toMatchObject({ value: count, milestone: true });
    let json;
    saveSession(wrapper.session, { setItem(key, value) { if (key === SESSION_KEY) json = value; } });
    expect(JSON.parse(json)).not.toHaveProperty('feedback');
    expect(JSON.parse(json)).not.toHaveProperty('eventId');
  }
});

it('is pure when React evaluates the same transition twice', () => {
  const wrapper = initial();
  expect(reduce(wrapper)).toEqual(reduce(wrapper));
  expect(wrapper.session.progress.score).toBe(0);
});

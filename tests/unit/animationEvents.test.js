import { expect, it } from 'vitest';
import { createSession, sessionReducer } from '../../src/lib/session.js';
import { isComplete } from '../../src/lib/exercise.js';
import { nextMove } from '../helpers/manualMoves.js';
import { describeAnimationTransition } from '../../src/lib/animationEvents.js';

const act = (state, type, extra = {}) => sessionReducer(state, { type, now: 1000, ...extra });

function reduceOnce(state, ruleOverride = null) {
  const move = nextMove(state.current.exercise);
  for (const id of move.ids) state = act(state, 'select', { id });
  const action = { type: 'reduce', rule: ruleOverride || move.rule, now: 1000 };
  const next = sessionReducer(state, action);
  return { state, action, next };
}

function solve(state) {
  while (!isComplete(state.current.exercise)) {
    const { next } = reduceOnce(state);
    state = next;
  }
  return state;
}

it('emits one geometry and reward event only after an accepted reduction', () => {
  const { state, action, next } = reduceOnce(createSession({ seed: 72, now: 0 }));
  const event = describeAnimationTransition(state, action, next, 'fx-1');
  expect(event).toMatchObject({ type: 'reduction', id: 'fx-1', stepPoints: 1, scoreBefore: 0, scoreAfter: 1 });
  expect(event.beforeExercise).toBe(state.current.exercise);
  expect(event.afterExercise).toBe(next.current.exercise);
});

it('does not emit a success event for a pending manual answer or an incorrect rule', () => {
  const manual = createSession({ seed: 72, settings: { manual: true }, now: 0 });
  const pendingMove = nextMove(manual.current.exercise);
  let state = manual;
  for (const id of pendingMove.ids) state = act(state, 'select', { id });
  const pendingAction = { type: 'reduce', rule: pendingMove.rule, now: 1000 };
  const pending = sessionReducer(state, pendingAction);
  expect(describeAnimationTransition(state, pendingAction, pending, 'fx-2')).toBeNull();

  const invalid = reduceOnce(createSession({ seed: 72, now: 0 }), 'series' === pendingMove.rule ? 'parallel' : 'series');
  expect(describeAnimationTransition(invalid.state, invalid.action, invalid.next, 'fx-3')).toBeNull();
});

it('captures the delivered exam exercise even when the reducer immediately starts the next one', () => {
  let state = createSession({ seed: 73, settings: { mode: 'exam', examCount: 3 }, now: 0 });
  state = act(state, 'start-exam');
  state = solve(state);
  const previous = state, action = { type: 'submit', now: 2000 };
  const next = sessionReducer(previous, action);
  const event = describeAnimationTransition(previous, action, next, 'fx-4');
  expect(event).toMatchObject({ type: 'completion', id: 'fx-4', source: 'exam', rewardPoints: 10 });
  expect(event.exerciseId).toBe(previous.current.exercise.id);
  expect(next.current.exercise.id).not.toBe(event.exerciseId);
});

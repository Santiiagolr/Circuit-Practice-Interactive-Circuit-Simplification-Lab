import { expect, it } from 'vitest';
import { createSession, sessionReducer, loadSession, saveSession, SESSION_KEY } from '../../src/lib/session.js';
import { PROGRESS_KEY } from '../../src/lib/gameState.js';
import { isComplete, prepareReduction } from '../../src/lib/exercise.js';
import { nextMove } from '../helpers/manualMoves.js';
import { parseQaConfig } from '../../src/lib/qaConfig.js';
const act = (s, type, extra = {}) => sessionReducer(s, { type, now: 1000, ...extra });
function move(state) {
  const next = nextMove(state.current.exercise, false, true);
  for (const id of next.ids) state = act(state, 'select', { id });
  return act(state, 'reduce', { rule: next.rule });
}
function complete(state) { while (!isComplete(state.current.exercise)) state = move(state); return state; }
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; };
it('keeps rewards independent of grouping size and awards only on delivery once', () => {
  let s = complete(createSession({ seed: 817, now: 0 }));
  expect(s.progress.score).toBe(0);
  const first = s.current.exercise;
  s = act(s, 'undo'); expect(isComplete(s.current.exercise)).toBe(false);
  s = act(s, 'redo'); expect(s.current.exercise).toEqual(first);
  s = act(s, 'submit'); expect(s.progress).toMatchObject({ score: 10, completed: 1, streak: 1 });
  expect(act(s, 'submit').progress).toEqual(s.progress);
});
it('undo keeps mistakes, hints and attempts, and a new branch clears redo', () => {
  let s = createSession({ seed: 7, progress: { streak: 3, bestStreak: 4 }, now: 0 });
  const next = nextMove(s.current.exercise);
  for (const id of next.ids) s = act(s, 'select', { id });
  s = act(s, 'reduce', { rule: next.rule === 'series' ? 'parallel' : 'series' });
  expect(s.progress.streak).toBe(0); expect(s.current.attempts.filter(a => a.kind === 'error')).toHaveLength(1);
  s = act(s, 'clear'); s = move(s); s = act(s, 'undo'); s = act(s, 'hint');
  expect(s.current.attempts.map(a => a.kind)).toEqual(['error', 'reduction', 'undo', 'hint']);
  s = move(s); expect(s.current.future).toHaveLength(0);
  expect(act(s, 'reduce', { rule: 'series' }).current.attempts).toEqual(s.current.attempts);
});
it('manual entry is atomic, stale/duplicate actions do not count as student mistakes', () => {
  let s = createSession({ seed: 7, settings: { manual: true, representation: 'symbolic', compType: 'C' }, now: 0 });
  const next = nextMove(s.current.exercise), before = s.current.exercise;
  for (const id of next.ids) s = act(s, 'select', { id });
  const expected = prepareReduction(before, next.ids, next.rule).value;
  s = act(s, 'reduce', { rule: next.rule });
  expect(s.current.exercise).toBe(before); expect(s.current.pending).toBeTruthy();
  s = act(s, 'answer', { text: 'alert(1)' }); expect(s.current.attempts).toHaveLength(0);
  s = act(s, 'answer', { text: '999C' }); expect(s.current.attempts).toHaveLength(1);
  s = act(s, 'answer', { text: `${expected.n}/${expected.d}C` });
  expect(s.current.exercise.edges.length).toBeLessThan(before.edges.length);
  expect(act(s, 'answer', { text: `${expected.n}/${expected.d}C` })).toBe(s);
});
it('preserves streak when changing config, requesting hints and undoing', () => {
  let s = createSession({ seed: 0, progress: { streak: 5, score: 100, bestStreak: 5 }, now: 0 });
  s = act(s, 'hint'); s = move(s); s = act(s, 'undo'); s = act(s, 'settings', { settings: { compType: 'C' } });
  expect(s.progress).toMatchObject({ streak: 5, score: 100 });
  expect(s.history.at(-1).attempts.at(-1).kind).toBe('configuration');
});
it('restores the full session and exact wire/open tags, migrates old progress', () => {
  const db = storage(); db.setItem(PROGRESS_KEY, JSON.stringify({ score: 75, streak: 3, bestStreak: 7, completed: 8 }));
  let s = loadSession({ storage: db, now: 4 }).state;
  expect(s.progress.score).toBe(75);
  s = act(s, 'settings', { settings: { difficulty: 'practice' }, seed: 4 });
  expect(saveSession(s, db)).toBe(true);
  const restored = loadSession({ storage: db, now: 1000 });
  expect(restored.warning).toBeNull();
  expect(restored.state.current.exercise.edges.map(e => e.value)).toEqual(s.current.exercise.edges.map(e => e.value));
  db.setItem(SESSION_KEY, '{');
  expect(loadSession({ storage: db, now: 9 }).state.progress.score).toBe(75);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  expect(loadSession({ storage: blocked, now: 8 }).warning).toBeTruthy();
  expect(saveSession(s, blocked)).toBe(false);
});
it('restores a QA-seeded exam on reload but starts fresh for a different explicit QA config', () => {
  const db = storage(), qa = parseQaConfig('?seed=78&type=C&difficulty=practice&values=equal&representation=symbolic', true, 1);
  let s = loadSession({ storage: db, qa, now: 10 }).state;
  expect(s.current.exercise.seed).toBe(78);
  s = sessionReducer(s, { type: 'settings', settings: { mode: 'exam', examCount: 3, examMinutes: 15 }, now: 20 });
  s = sessionReducer(s, { type: 'start-exam', seed: 79, now: 30 });
  expect(saveSession(s, db)).toBe(true);
  const restored = loadSession({ storage: db, qa, now: 40 }).state;
  expect(restored.exam).toMatchObject({ status: 'active', count: 3 });
  expect(restored.settings.mode).toBe('exam');
  expect(restored.current.exercise.settings.compType).toBe('C');
  const other = loadSession({ storage: db, qa: parseQaConfig('?seed=79&type=C&difficulty=practice&values=equal&representation=symbolic', true, 1), now: 50 }).state;
  expect(other.exam).toBeNull();
  expect(other.current.exercise.seed).toBe(79);
});
it('applies the explicitly requested QA mode without auto-starting or solving an exam', () => {
  const qa = parseQaConfig('?seed=12&mode=exam', true, 1);
  const state = loadSession({ storage: storage(), qa, now: 10 }).state;
  expect(state.settings.mode).toBe('exam');
  expect(state.exam).toBeNull();
  expect(isComplete(state.current.exercise)).toBe(false);
});
it('rejects a malformed persisted exam shape without discarding saved score', () => {
  const db = storage();
  let state = createSession({ seed: 25, settings: { mode: 'exam', examCount: 3 }, progress: { score: 21 }, now: 0 });
  state = act(state, 'start-exam', { now: 10 });
  saveSession(state, db);
  const corrupt = JSON.parse(db.getItem(SESSION_KEY));
  corrupt.exam.results = { invalid: true };
  db.setItem(SESSION_KEY, JSON.stringify(corrupt));
  const recovered = loadSession({ storage: db, now: 20 });
  expect(recovered.warning).toBeTruthy();
  expect(recovered.state.exam).toBeNull();
  expect(recovered.state.progress.score).toBe(21);
});
it('freezes exam config, expires on reload and marks all pending exercises incomplete', () => {
  let s = createSession({ seed: 0, settings: { mode: 'exam', examMinutes: 15, examCount: 3 }, now: 0 });
  s = act(s, 'start-exam', { now: 100, seed: 9 });
  expect(act(s, 'settings', { settings: { compType: 'C' } })).toBe(s);
  expect(act(s, 'hint')).toBe(s);
  s = act(complete(s), 'submit', { now: 1000 });
  const db = storage(); saveSession(s, db);
  s = loadSession({ storage: db, now: 900101 }).state;
  expect(s.exam.status).toBe('finished'); expect(s.exam.results.map(r => r.status)).toEqual(['complete', 'incomplete', 'incomplete']);
  expect(act(s, 'submit').progress.completed).toBe(1);
});
it('completes a three-exercise mock exam and does not double-deliver', () => {
  let s = createSession({ seed: 0, settings: { mode: 'exam', examCount: 3 }, now: 0 });
  s = act(s, 'start-exam');
  for (let i = 0; i < 3; i++) s = act(complete(s), 'submit');
  expect(s.exam.status).toBe('finished'); expect(s.exam.results).toHaveLength(3);
  expect(s.progress).toMatchObject({ score: 45, streak: 3, completed: 3 });
  expect(act(s, 'submit')).toBe(s);
});

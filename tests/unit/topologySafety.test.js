import { describe, expect, it } from 'vitest';
import { createSession, sessionReducer } from '../../src/lib/session.js';
import { generateExercise, reduceExercise } from '../../src/lib/exercise.js';
import { validateTopology, verifyTopologyCertificate } from '../../src/lib/topology.js';
import { classifyFromDefinition } from '../helpers/topologySpecification.js';

const terminals = [{ id: 'A', terminal: true }, { id: 'B', terminal: true }];
const edge = (id, from, to, extra = {}) => ({ id, from, to, compType: 'R', ...extra });

describe('electrical topology fails closed', () => {
  it.each([
    ['missing endpoint node', terminals, [edge('r1', 'A', 'X'), edge('r2', 'X', 'B')], 'missing-component-node'],
    ['duplicate node identity', [...terminals, { id: 'A', terminal: true }], [edge('r1', 'A', 'B'), edge('r2', 'A', 'B')], 'invalid-node-identity'],
    ['duplicate component identity', terminals, [edge('same', 'A', 'B'), edge('same', 'A', 'B')], 'invalid-component-identity'],
    ['damaged source marker', [{ id: 'A' }, terminals[1]], [edge('r1', 'A', 'B'), edge('r2', 'A', 'B')], 'invalid-source-terminals'],
    ['component connected to itself', terminals, [edge('r1', 'A', 'A'), edge('r2', 'A', 'B')], 'self-connected-component'],
    ['detached component group', [...terminals, { id: 'X' }, { id: 'Y' }], [edge('r1', 'A', 'B'), edge('r2', 'X', 'Y')], 'disconnected-network'],
  ])('rejects a malformed graph: %s', (_label, nodes, edges, code) => {
    const result = validateTopology(nodes, edges, ['r1', 'r2'], 'parallel');
    expect(result).toMatchObject({ valid: false, status: 'fault', kind: 'fault', code });
  });

  it('does not misclassify an open switch as a student topology error', () => {
    const nodes = [...terminals, { id: 'X' }];
    const edges = [edge('r1', 'A', 'X'), edge('s1', 'X', 'B', { compType: 'S', switchState: 'open' }), edge('r2', 'X', 'B')];
    expect(validateTopology(nodes, edges, ['r1', 's1'], 'series')).toMatchObject({ valid: false, status: 'prerequisite', code: 'open-switch-first' });
  });

  it('issues a certificate for a valid chain and rejects altered evidence', () => {
    const nodes = [terminals[0], { id: 'X' }, { id: 'Y' }, terminals[1]];
    const edges = [edge('r1', 'A', 'X'), edge('r2', 'X', 'Y'), edge('r3', 'Y', 'B')];
    const result = validateTopology(nodes, edges, ['r3', 'r1', 'r2'], 'series');
    expect(result).toMatchObject({ valid: true, status: 'valid', code: 'series-single-path' });
    expect(verifyTopologyCertificate(nodes, edges, ['r2', 'r3', 'r1'], 'series', result.certificate).valid).toBe(true);
    const alteredWitness = { ...result.certificate, witness: [...result.certificate.witness, 'A'] };
    expect(verifyTopologyCertificate(nodes, edges, ['r1', 'r2', 'r3'], 'series', alteredWitness)).toMatchObject({ valid: false, status: 'fault', code: 'series-witness-mismatch' });
    expect(verifyTopologyCertificate(nodes, edges, ['r1', 'r2'], 'series', result.certificate)).toMatchObject({ valid: false, status: 'fault', code: 'certificate-selection-mismatch' });
    expect(verifyTopologyCertificate(nodes, [edges[0], edges[1], edge('r3', 'A', 'B')], ['r1', 'r2', 'r3'], 'series', result.certificate)).toMatchObject({ valid: false, status: 'fault', code: 'stale-topology-certificate' });
  });

  it('distinguishes three true parallels from two elements that only look adjacent', () => {
    const nodes = [...terminals, { id: 'X' }];
    const edges = [edge('p1', 'A', 'B'), edge('p2', 'B', 'A'), edge('p3', 'A', 'B'), edge('near', 'A', 'X')];
    expect(validateTopology(nodes, edges, ['p3', 'p1'], 'parallel').valid).toBe(true);
    expect(validateTopology(nodes, edges, ['p1', 'near'], 'parallel')).toMatchObject({ valid: false, code: 'parallel-node-pair-mismatch' });
  });
});

describe('production topology classifier matches a separate graph specification', () => {
  it('exhaustively checks every multigraph with up to five nodes and six components', () => {
    const names = ['A', 'B', 'N1', 'N2', 'N3'];
    const possiblePairs = [];
    for (let i = 0; i < names.length; i += 1) for (let j = i; j < names.length; j += 1) possiblePairs.push([names[i], names[j]]);
    let checked = 0;
    for (let count = 2; count <= 6; count += 1) {
      const visit = (start, pairs) => {
        if (pairs.length === count) {
          const nodes = names.map(id => ({ id, ...(id === 'A' || id === 'B' ? { terminal: true } : {}) }));
          const edges = pairs.map(([from, to], index) => edge(`e${index}`, from, to));
          const subsets = 1 << count;
          for (let mask = 0; mask < subsets; mask += 1) {
            const ids = edges.filter((_item, index) => mask & (1 << index)).map(item => item.id);
            if (ids.length < 2) continue;
            for (const rule of ['series', 'parallel']) {
              const expected = classifyFromDefinition(nodes, edges, ids, rule);
              const result = validateTopology(nodes, edges, ids, rule);
              expect(result.valid, `${rule}: ${ids.join(',')} in ${JSON.stringify(pairs)}`).toBe(expected);
              if (result.valid) expect(verifyTopologyCertificate(nodes, edges, ids, rule, result.certificate).valid).toBe(true);
              checked += 1;
            }
          }
          return;
        }
        for (let index = start; index < possiblePairs.length; index += 1) visit(index, [...pairs, possiblePairs[index]]);
      };
      visit(0, []);
    }
    expect(checked).toBeGreaterThan(500_000);
  }, 120_000);
});

it('rejects a damaged exercise without penalizing the learner or changing the circuit', () => {
  let state = createSession({ seed: 451, now: 0 });
  state = { ...state, progress: { ...state.progress, streak: 3 } };
  const brokenExercise = { ...state.current.exercise, edges: state.current.exercise.edges.map((item, index) => index ? item : { ...item, from: 'missing-node' }) };
  const selected = brokenExercise.edges.slice(0, 2).map(item => item.id);
  state = { ...state, current: { ...state.current, exercise: brokenExercise, selected } };
  const result = sessionReducer(state, { type: 'reduce', rule: 'parallel', now: 1 });
  expect(result.current.exercise).toBe(brokenExercise);
  expect(result.current.attempts).toHaveLength(0);
  expect(result.progress.streak).toBe(3);
  expect(result.current.notice.kind).toBe('error');
});

it('does not restore a corrupted undo snapshot or count it as a learner error', () => {
  let state = createSession({ seed: 452, now: 0 });
  const broken = { ...state.current.exercise, edges: state.current.exercise.edges.map((item, index) => index ? item : { ...item, to: 'missing-node' }) };
  state = { ...state, progress: { ...state.progress, streak: 4 }, current: { ...state.current, past: [broken] } };
  const next = sessionReducer(state, { type: 'undo', now: 10 });
  expect(next.current.exercise).toBe(state.current.exercise);
  expect(next.current.attempts).toHaveLength(0);
  expect(next.progress.streak).toBe(4);
  expect(next.current.notice).toMatchObject({ kind: 'error' });
});

it.each(['R', 'C'])('keeps %s identities and values consistent through manual reduction', compType => {
  const exercise = generateExercise({ compType, difficulty: 'challenge' }, 901);
  let move;
  for (let i = 0; i < exercise.edges.length && !move; i += 1) for (let j = i + 1; j < exercise.edges.length && !move; j += 1) {
    const pair = [exercise.edges[i], exercise.edges[j]];
    if (pair.some(item => item.compType === 'S' && item.switchState === 'open')) continue;
    for (const rule of ['parallel', 'series']) {
      if (classifyFromDefinition(exercise.nodes, exercise.edges, pair.map(item => item.id), rule)) { move = { pair, rule }; break; }
    }
  }
  expect(move).toBeDefined();
  const reduced = reduceExercise(exercise, move.pair.map(item => item.id), move.rule);
  expect(reduced.valid).toBe(true);
  expect(new Set(reduced.exercise.edges.map(item => item.id)).size).toBe(reduced.exercise.edges.length);
});

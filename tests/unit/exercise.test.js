import { expect, it } from 'vitest';
import { generateExercise, reduceExercise, treeDepth, LEVELS, structuralSignature } from '../../src/lib/exercise.js';
import { inspectDrawing } from '../../src/lib/technicalDrawing.js';
import { validateTopology } from '../../src/lib/topology.js';
import { numericValue } from '../../src/lib/values.js';
import { evaluateGraphNetwork, expectClose } from '../helpers/oracle.js';
import { reduceAll, nextMove } from '../helpers/manualMoves.js';
it.each(['R', 'C'])('reduces %s against an independent nodal evaluator in arbitrary orders', compType => {
  for (const difficulty of Object.keys(LEVELS)) for (let seed = 0; seed < 40; seed++) {
    const e = generateExercise({ compType, difficulty }, seed);
    const expected = evaluateGraphNetwork(e.nodes, e.edges, compType);
    expect(e.edges.length).toBeGreaterThanOrEqual(LEVELS[difficulty].min);
    expect(e.edges.length).toBeLessThanOrEqual(LEVELS[difficulty].max);
    expect(treeDepth(e.tree)).toBeLessThanOrEqual(LEVELS[difficulty].depth);
    reduceAll(e, !!(seed % 2), !!(seed % 3), state => {
      expect(inspectDrawing(state)).toEqual([]);
      expect(expectClose(evaluateGraphNetwork(state.nodes, state.edges, compType), expected)).toBe(true);
    });
  }
});
it('keeps stable routes of unselected components, accepts N and rejects duplicates/stale IDs', () => {
  const e = generateExercise({ difficulty: 'challenge' }, 2), move = nextMove(e, true, true);
  expect(validateTopology(e.nodes, e.edges, ['c1', 'c1'], 'parallel').kind).toBe('interface');
  expect(validateTopology(e.nodes, e.edges, ['missing', 'c1'], 'series').kind).toBe('interface');
  const result = reduceExercise(e, move.ids, move.rule);
  expect(result.valid).toBe(true);
  for (const edge of result.exercise.edges.filter(edge => !edge.equivalent)) expect(edge.route).toEqual(e.edges.find(item => item.id === edge.id).route);
});
it.each([[2, 4], [1, 5]])('renders a real integrated diagonal for geometric family %i', (seed, familyIndex) => {
  const exercise = generateExercise({ difficulty: 'challenge' }, seed);
  expect(exercise.familyIndex).toBe(familyIndex);
  expect(exercise.edges.some(edge => edge.route.some((point, index, route) => index > 0 && point.x !== route[index - 1].x && point.y !== route[index - 1].y))).toBe(true);
  expect(inspectDrawing(exercise)).toEqual([]);
});
it('prunes an entire hanging loop after manually removing an open switch', () => {
  const e = generateExercise({ difficulty: 'practice' }, 4);
  const final = reduceAll(e);
  expect(expectClose(numericValue(final.edges[0].value, 'R'), evaluateGraphNetwork(e.nodes, e.edges, 'R'))).toBe(true);
});
it('ignores mirrored order, values and labels in signatures and avoids twenty recent structures', () => {
  const recent = [];
  for (let seed = 0; seed < 100; seed++) {
    const e = generateExercise({}, seed, recent);
    expect(recent).not.toContain(e.signature);
    recent.push(e.signature); if (recent.length > 20) recent.shift();
    expect(structuralSignature({ ...e.tree, children: [...e.tree.children].reverse() })).toBe(e.signature);
  }
});

import { describe, expect, it } from 'vitest';
import {
  calculateEquivalent,
  combineNodes,
  generateBasicExercise,
  validateSelection,
} from '../../src/lib/circuit';
import { evaluateTree, expectClose, oracleCombine } from '../helpers/oracle';

describe.each([
  ['R', 'series', [10, 20, 30], 60],
  ['R', 'parallel', [10, 20], 20 / 3],
  ['R', 'parallel', [0, 30], 0],
  ['R', 'series', [10, Infinity], Infinity],
  ['R', 'parallel', [Infinity, 20], 20],
  ['C', 'parallel', [10, 20, 30], 60],
  ['C', 'series', [10, 20], 20 / 3],
  ['C', 'series', [0, 20], 0],
  ['C', 'parallel', [Infinity, 20], Infinity],
  ['C', 'series', [Infinity, 20], 20],
])('equivalent physics', (compType, mode, values, expected) => {
  it(`${compType} ${mode} ${values.join(',')}`, () => {
    expectClose(calculateEquivalent(compType, values, mode), expected);
    expectClose(calculateEquivalent(compType, values, mode), oracleCombine(compType, values, mode));
  });
});

it('combines an arbitrary-order selection of four adjacent series leaves', () => {
  const tree = {
    type: 'series', id: 'root', children: [10, 20, 30, 40].map((val, index) => ({
      type: 'leaf', id: `r${index}`, compType: 'R', label: `R${index + 1}`, val,
    })),
  };
  const ids = ['r3', 'r1', 'r0', 'r2'];
  expect(validateSelection(tree, ids, 'series').valid).toBe(true);
  const result = combineNodes(tree, ids, 'series', 'R');
  expect(result.type).toBe('leaf');
  expect(result.val).toBe(100);
});

it('preserves an infinite capacitor wire while cloning and reducing', () => {
  const tree = {
    type: 'parallel', id: 'root', children: [
      { type: 'leaf', id: 'c1', compType: 'C', label: 'C1', val: 12 },
      { type: 'leaf', id: 'wire', compType: 'W', label: 'W', val: Infinity },
    ],
  };
  const result = combineNodes(tree, ['c1', 'wire'], 'parallel', 'C');
  expect(result.type).toBe('leaf');
  expect(result.compType).toBe('W');
  expect(result.val).toBe(Infinity);
});

it('rejects stale IDs, separated series leaves and false parallel groups', () => {
  const tree = {
    type: 'series', id: 'root', children: [
      { type: 'leaf', id: 'a', val: 10 },
      { type: 'parallel', id: 'p', children: [
        { type: 'leaf', id: 'b', val: 20 },
        { type: 'leaf', id: 'c', val: 30 },
      ] },
      { type: 'leaf', id: 'd', val: 40 },
    ],
  };
  expect(validateSelection(tree, ['a', 'missing'], 'series').valid).toBe(false);
  expect(validateSelection(tree, ['a', 'd'], 'series').valid).toBe(false);
  expect(validateSelection(tree, ['a', 'd'], 'parallel').valid).toBe(false);
});

it('matches an independent recursive evaluator across generated seeds', () => {
  for (const compType of ['R', 'C']) {
    for (const difficulty of ['guided', 'practice', 'challenge']) {
      for (let seed = 0; seed < 40; seed += 1) {
        const exercise = generateBasicExercise(compType, { difficulty, seed: `unit:${seed}` });
        expect(expectClose(evaluateTree(exercise.tree, compType), evaluateTree(exercise.tree, compType))).toBe(true);
      }
    }
  }
});

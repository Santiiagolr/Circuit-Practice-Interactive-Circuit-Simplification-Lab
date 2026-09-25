import { describe, expect, it } from 'vitest';
import { createMiniExercise, TOPICS } from '../../src/lib/topicPractice.js';
import { classifyFromDefinition } from '../helpers/topologySpecification.js';
import { generateExercise, LEVELS } from '../../src/lib/exercise.js';
import { evaluateGraphNetwork, expectClose } from '../helpers/oracle.js';
import { reduceAll } from '../helpers/manualMoves.js';

describe('topic mini exercises use real, verifiable circuit graphs', () => {
  it.each(TOPICS)('builds truthful $title examples over varied seeds', topic => {
    for (let seed = 0; seed < 250; seed += 1) {
      const mini = createMiniExercise(topic.id, seed, seed % 7, { representation: 'numeric', rUnit: 'Ω', cUnit: 'µF' });
      const expected = classifyFromDefinition(mini.nodes, mini.edges, mini.selectedIds, topic.rule);
      expect(mini.answer).toBe(expected ? 'yes' : 'no');
      expect(mini.edges.filter(edge => edge.compType !== topic.compType)).toEqual([]);
      expect(mini.edges.length).toBeGreaterThanOrEqual(2);
      expect(mini.edges.length).toBeLessThanOrEqual(3);
      expect(mini.selectedIds).toHaveLength(2);
      expect(mini.nodes.find(node => node.id === 'A')?.terminal).toBe(true);
      expect(mini.nodes.find(node => node.id === 'B')?.terminal).toBe(true);
    }
  });

  it.each(TOPICS)('generates reducible focused circuits for $title at every difficulty', topic => {
    for (const difficulty of Object.keys(LEVELS)) {
      const recent = [], signatures = new Set(), topologySignatures = new Set();
      for (let seed = 0; seed < 50; seed += 1) {
        const exercise = generateExercise({ compType: topic.compType, difficulty, focusRule: topic.rule }, seed, recent);
        expect(exercise.tree.type).toBe(topic.rule);
        expect(exercise.edges.length).toBeGreaterThanOrEqual(LEVELS[difficulty].min);
        expect(exercise.edges.length).toBeLessThanOrEqual(LEVELS[difficulty].max);
        expect(recent).not.toContain(exercise.signature);
        recent.push(exercise.signature); if (recent.length > 20) recent.shift();
        signatures.add(exercise.signature);
        topologySignatures.add(exercise.topologySignature);
        const expected = evaluateGraphNetwork(exercise.nodes, exercise.edges, topic.compType);
        expect(expected).toBeGreaterThan(0);
        reduceAll(exercise, Boolean(seed % 2), Boolean(seed % 3), state => {
          expect(expectClose(evaluateGraphNetwork(state.nodes, state.edges, topic.compType), expected)).toBe(true);
        });
      }
      expect(signatures.size).toBeGreaterThan(35);
      expect(topologySignatures.size).toBeGreaterThan(10);
    }
  });
});

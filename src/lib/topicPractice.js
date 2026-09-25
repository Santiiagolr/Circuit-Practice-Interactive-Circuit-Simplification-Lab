import { createSeededRandom } from './circuit.js';
import { validateTopology } from './topology.js';
import { rational } from './values.js';

export const TOPICS = Object.freeze([
  { id: 'R-series', compType: 'R', rule: 'series', title: 'Resistencias en serie', shortTitle: 'R · Serie' },
  { id: 'R-parallel', compType: 'R', rule: 'parallel', title: 'Resistencias en paralelo', shortTitle: 'R · Paralelo' },
  { id: 'C-series', compType: 'C', rule: 'series', title: 'Capacitores en serie', shortTitle: 'C · Serie' },
  { id: 'C-parallel', compType: 'C', rule: 'parallel', title: 'Capacitores en paralelo', shortTitle: 'C · Paralelo' },
]);
export const createTopicProgress = () => Object.fromEntries(TOPICS.map(topic => [topic.id, { minis: 0, miniCorrect: 0, miniErrors: 0, circuits: 0, circuitErrors: 0 }]));

export function validateTopicProgress(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([id, counts]) => TOPICS.some(topic => topic.id === id)
      && counts && ['minis', 'miniCorrect', 'miniErrors', 'circuits', 'circuitErrors'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
      && counts.miniCorrect <= counts.minis));
}

const componentValue = (type, number) => type === 'R' ? rational(number) : rational(number, 1_000_000);

export function createMiniExercise(topicId, seed, index = 0, settings = {}) {
  const topic = TOPICS.find(item => item.id === topicId);
  if (!topic) throw new Error('Tema de práctica desconocido.');
  const random = createSeededRandom(`${seed}:${topicId}:mini:${index}`);
  const targetIsValid = random() >= 0.38;
  const values = [10 + Math.floor(random() * 5) * 10, 10 + Math.floor(random() * 5) * 10, 10 + Math.floor(random() * 5) * 10];
  const label = n => `${topic.compType}${n}`;
  const component = (id, from, to, valueIndex) => ({ id, from, to, label: label(valueIndex + 1), compType: topic.compType, value: componentValue(topic.compType, values[valueIndex]) });
  const nodes = [{ id: 'A', terminal: true }, { id: 'B', terminal: true }];
  let edges, layout;
  if (topic.rule === 'series' && !targetIsValid) {
    edges = [component('m1', 'A', 'X', 0), component('m2', 'X', 'B', 1), component('m3', 'X', 'B', 2)];
    layout = 'branched-series';
  } else if (topic.rule === 'parallel' && targetIsValid) {
    edges = [component('m1', 'A', 'B', 0), component('m2', 'A', 'B', 1)];
    layout = 'parallel';
  } else {
    edges = [component('m1', 'A', 'X', 0), component('m2', 'X', 'B', 1)];
    layout = 'series';
  }
  if (edges.some(edge => edge.from === 'X' || edge.to === 'X')) nodes.push({ id: 'X' });
  const selectedIds = ['m1', 'm2'];
  const classification = validateTopology(nodes, edges, selectedIds, topic.rule);
  if (classification.status === 'fault') throw new Error(`No se pudo validar el mini ejercicio: ${classification.message}`);
  return {
    topicId,
    seed,
    index,
    layout,
    settings: { ...settings, compType: topic.compType },
    nodes,
    edges,
    selectedIds,
    rule: topic.rule,
    answer: classification.valid ? 'yes' : 'no',
    validationCode: classification.code,
    explanation: classification.valid
      ? topic.rule === 'series'
        ? 'El nodo compartido conecta únicamente estos dos componentes y no es un terminal de la fuente.'
        : 'Ambos componentes conectan exactamente los mismos dos nodos.'
      : topic.rule === 'series'
        ? 'El nodo intermedio tiene una tercera conexión: allí existe una derivación, así que la corriente puede dividirse.'
        : 'Los componentes no comparten los mismos dos nodos; conectan tramos distintos de la rama.'
  };
}

export function validateTopicSession(value) {
  return Boolean(value && TOPICS.some(topic => topic.id === value.topicId)
    && ['mini', 'circuit'].includes(value.phase)
    && Number.isSafeInteger(value.seed)
    && Number.isInteger(value.miniIndex) && value.miniIndex >= 0
    && Number.isInteger(value.minisInCycle) && value.minisInCycle >= 0 && value.minisInCycle <= 2
    && typeof value.answered === 'boolean'
    && (value.lastAnswer == null || ['yes', 'no'].includes(value.lastAnswer))
    && (value.lastCorrect == null || typeof value.lastCorrect === 'boolean')
    && (value.answered ? ['yes', 'no'].includes(value.lastAnswer) && typeof value.lastCorrect === 'boolean' : value.lastAnswer == null && value.lastCorrect == null)
    && (value.phase !== 'circuit' || value.minisInCycle === 2 && !value.answered)
    && (value.phase !== 'mini' || value.minisInCycle < 2 || value.answered)
    && Number.isInteger(value.cycles) && value.cycles >= 0);
}

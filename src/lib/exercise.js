import { createSeededRandom } from './circuit.js';
import { astToNetwork, inspectTopologyNetwork, validateTopology, verifyTopologyCertificate } from './topology.js';
import { combineValues, isExactValue, numericValue, rational, multiply, UNIT_FACTORS, WIRE, OPEN } from './values.js';
import { layoutNetwork, routeBetweenPorts, inspectDrawing } from './technicalDrawing.js';

export const LEVELS = {
  guided: { label: 'Básica', min: 4, max: 6, depth: 2, points: 10 },
  practice: { label: 'Intermedia', min: 7, max: 10, depth: 3, points: 20 },
  challenge: { label: 'Avanzada', min: 11, max: 15, depth: 5, points: 35 },
};
export const FAMILIES = ['Marco rectangular', 'Escalera', 'Celdas apiladas', 'Travesaños', 'Celda triangular', 'Marco con diagonal'];
export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'training', difficulty: 'guided', compType: 'R', valueMode: 'varied',
  representation: 'numeric', resistorStyle: 'zigzag', manual: false,
  flow: false, rUnit: 'Ω', cUnit: 'µF', examCount: 5, examMinutes: 0,
  theme: 'light',
});
export function normalizeSettings(value = {}) {
  const next = { ...DEFAULT_SETTINGS };
  const choices = { mode: ['training', 'exam'], difficulty: Object.keys(LEVELS), compType: ['R', 'C'], valueMode: ['varied', 'equal'], representation: ['numeric', 'symbolic'], resistorStyle: ['zigzag', 'rectangle'], rUnit: ['Ω', 'kΩ'], cUnit: ['µF', 'nF'], examCount: [3, 5, 10], examMinutes: [0, 15, 30, 60], theme: ['light', 'dark'] };
  for (const [key, options] of Object.entries(choices)) if (options.includes(value[key])) next[key] = value[key];
  for (const key of ['manual', 'flow']) if (typeof value[key] === 'boolean') next[key] = value[key];
  return next;
}
const integer = (random, min, max) => min + Math.floor(random() * (max - min + 1));
export function structuralSignature(node) {
  if (node.type === 'leaf') return node.compType === 'S' ? `S:${node.switchState}` : node.compType === 'W' ? 'W' : 'X';
  const children = node.children.map(structuralSignature);
  if (node.type === 'parallel') children.sort();
  const forward = children.join(','), reverse = [...children].reverse().join(',');
  return `${node.type === 'series' ? 'S' : 'P'}(${forward < reverse ? forward : reverse})`;
}
export function evaluateExactTree(node, type) {
  return node.type === 'leaf' ? node.value : combineValues(node.children.map(child => evaluateExactTree(child, type)), node.type, type);
}
export function treeDepth(node) { return node.type === 'leaf' ? 0 : 1 + Math.max(...node.children.map(treeDepth)); }

function exerciseFault(code, message) {
  return { valid: false, status: 'fault', kind: 'fault', code, message };
}

/** Validate the electrical contract and its diagram before any state transition. */
export function inspectExercise(exercise) {
  if (!exercise || !exercise.settings || !['R', 'C'].includes(exercise.settings.compType)) return exerciseFault('invalid-exercise-settings', 'El ejercicio no declara un tipo eléctrico compatible.');
  const topology = inspectTopologyNetwork(exercise.nodes, exercise.edges);
  if (!topology.valid) return { ...topology, kind: 'fault' };
  if (!Array.isArray(exercise.buses) || exercise.buses.length !== exercise.nodes.length || !Array.isArray(exercise.sourceRoute) || exercise.sourceRoute.length < 2 || !exercise.bounds || !Number.isFinite(exercise.bounds.width) || !Number.isFinite(exercise.bounds.height) || exercise.bounds.width <= 0 || exercise.bounds.height <= 0 || exercise.nodes.some(node => !Number.isFinite(node.x) || !Number.isFinite(node.y))) {
    return exerciseFault('invalid-exercise-geometry', 'El circuito no contiene una geometría completa.');
  }
  const busIds = new Set();
  for (const bus of exercise.buses) {
    const coordinate = bus?.axis === 'x' ? bus.y : bus?.axis === 'y' ? bus.x : NaN;
    if (!bus || !topology.nodeById.has(bus.id) || busIds.has(bus.id) || !Number.isFinite(coordinate)) return exerciseFault('invalid-node-bus', 'Un nodo no tiene una guía geométrica única y válida.');
    busIds.add(bus.id);
  }
  for (const edge of exercise.edges) {
    if (!isExactValue(edge.value)) return exerciseFault('invalid-component-value', `El valor de ${edge.label || edge.id} no es una cantidad exacta válida.`);
    if (edge.compType === 'S') {
      const expected = edge.switchState === 'open' ? OPEN.kind : edge.switchState === 'closed' ? WIRE.kind : null;
      if (!expected || edge.value.kind !== expected) return exerciseFault('switch-state-value-mismatch', `El estado y el valor del interruptor ${edge.label || edge.id} no coinciden.`);
    } else if (edge.compType === 'W') {
      if (edge.value.kind !== 'wire' && !(exercise.settings.compType === 'R' && edge.equivalent && edge.value.kind === 'finite' && edge.value.n === '0')) {
        return exerciseFault('wire-value-mismatch', `El valor del cable ${edge.label || edge.id} no representa un conductor ideal.`);
      }
    } else if (edge.compType !== exercise.settings.compType) {
      return exerciseFault('mixed-component-types', `El componente ${edge.label || edge.id} no corresponde al tipo de este ejercicio.`);
    } else if (edge.value.kind === 'finite') {
      if (edge.value.n === '0' && !(edge.equivalent && exercise.settings.compType === 'C')) return exerciseFault('zero-passive-component', `${edge.label || edge.id} tiene un valor físico nulo.`);
      if (edge.value.n === '0' && exercise.settings.compType === 'C' && !edge.equivalent) return exerciseFault('zero-passive-component', `${edge.label || edge.id} tiene una capacitancia física nula.`);
    } else if (!(edge.equivalent && edge.value.kind === 'open')) {
      return exerciseFault('passive-component-special-value', `${edge.label || edge.id} usa un estado reservado para conductores o interruptores.`);
    }
    const expectedNumeric = numericValue(edge.value, exercise.settings.compType);
    if (edge.val !== undefined && !Object.is(edge.val, expectedNumeric)) return exerciseFault('inconsistent-numeric-cache', `El valor numérico de ${edge.label || edge.id} no coincide con su valor exacto.`);
    if (!Array.isArray(edge.route) || edge.route.length < 2 || edge.route.length > 100 || !edge.route.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) {
      return exerciseFault('invalid-component-route', `La ruta de ${edge.label || edge.id} no es válida.`);
    }
  }
  if (!exercise.sourceRoute.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return exerciseFault('invalid-source-route', 'La batería no está conectada mediante una ruta válida.');
  try {
    const geometryIssues = inspectDrawing(exercise);
    if (geometryIssues.length) return { ...exerciseFault('invalid-drawing', 'El dibujo no representa una red geométrica segura.'), issues: geometryIssues };
  } catch {
    return exerciseFault('invalid-drawing', 'No se pudo comprobar que el dibujo coincida con el circuito.');
  }
  return { valid: true, status: 'valid', code: 'valid-exercise' };
}

export function generateExercise(input = DEFAULT_SETTINGS, seed = Date.now(), recent = []) {
  const settings = normalizeSettings(input), level = LEVELS[settings.difficulty];
  for (let attempt = 0; attempt < 512; attempt++) {
    const random = createSeededRandom(`${seed}:${settings.difficulty}:${attempt}`);
    let nextLeaf = 0, nextGroup = 0;
    const unit = settings.compType === 'R' ? settings.rUnit : settings.cUnit;
    const leaves = [];
    const family = integer(random, 0, settings.difficulty === 'guided' ? 3 : FAMILIES.length - 1);
    function build(count, depth, parent) {
      if (count === 1) {
        const coefficient = settings.valueMode === 'equal' ? 2 : integer(random, 1, 6);
        const value = settings.representation === 'symbolic' ? rational(coefficient) : multiply(rational(coefficient * 10), UNIT_FACTORS[unit][1]);
        const leaf = { type: 'leaf', id: `c${++nextLeaf}`, label: `${settings.compType}${nextLeaf}`, compType: settings.compType, value, val: numericValue(value, settings.compType) };
        leaves.push(leaf); return leaf;
      }
      const type = parent ? (parent === 'series' ? 'parallel' : 'series') : random() < 0.5 ? 'series' : 'parallel';
      const n = depth === level.depth ? count : integer(random, 2, Math.min(count, settings.difficulty === 'guided' ? 4 : 3));
      const parts = Array(n).fill(1);
      for (let remaining = count - n; remaining > 0; remaining--) parts[integer(random, 0, n - 1)]++;
      return { id: `g${++nextGroup}`, type, children: parts.map(size => build(size, depth + 1, type)) };
    }
    let tree = build(integer(random, level.min, level.max), 1);
    if (family >= 4) {
      const rest = leaves.slice(3);
      function regroup(items, depth, parent) {
        if (items.length === 1) return items[0];
        const type = parent === 'series' ? 'parallel' : 'series';
        const parts = Math.min(items.length, depth >= level.depth ? items.length : 2 + integer(random, 0, 1));
        const groups = Array.from({ length: parts }, () => []);
        items.forEach((leaf, index) => groups[index % parts].push(leaf));
        return { type, id: `g${++nextGroup}`, children: groups.map(group => regroup(group, depth + 1, type)) };
      }
      const triangle = { type: 'parallel', id: `g${++nextGroup}`, children: [leaves[0], { type: 'series', id: `g${++nextGroup}`, children: leaves.slice(1, 3) }] };
      const remainder = rest.length ? regroup(rest, 2, 'series') : null;
      tree = remainder ? { type: 'series', id: `g${++nextGroup}`, children: [triangle, remainder] } : triangle;
    }
    if (!tree.children.some(child => child.type !== 'leaf')) continue;
    if (settings.difficulty !== 'guided' && random() < 0.7) {
      const treeLeaves = [];
      const collectLeaves = node => { if (node.type === 'leaf') treeLeaves.push(node); else node.children.forEach(collectLeaves); };
      collectLeaves(tree);
      const leaf = treeLeaves[integer(random, 0, treeLeaves.length - 1)];
      const choice = integer(random, 0, 2);
      leaf.compType = choice === 0 ? 'W' : 'S';
      leaf.switchState = choice === 2 ? 'open' : 'closed';
      leaf.label = choice === 0 ? 'W1' : 'S1';
      leaf.value = choice === 2 ? OPEN : WIRE;
      leaf.val = numericValue(leaf.value, settings.compType);
    }
    const expected = numericValue(evaluateExactTree(tree, settings.compType), settings.compType);
    if (!(expected > 0 && Number.isFinite(expected))) continue;
    const signature = structuralSignature(tree);
    if (recent.slice(-20).includes(signature)) continue;
    const network = layoutNetwork(tree, family);
    const exercise = { ...network, tree, id: `exercise-${seed}`, seed, signature, family: FAMILIES[family], familyIndex: family, attempt, fallback: false, settings, revision: 0, nextEquivalent: 1, initialCount: leaves.length };
    // Geometry is validated before it becomes visible, not merely in a test runner.
    if (inspectDrawing(exercise).length) continue;
    return exercise;
  }
  // Never silently substitute an easier circuit or a known recent structure.
  throw new Error('No se pudo construir un diagrama legible de este nivel. Probá una semilla nueva.');
}

function prune(nodes, edges) {
  // Degree-one pruning alone misses a dangling loop attached through one node.
  // Keep the terminal corridor: the union of simple A–B paths (at most 15 edges).
  const live = new Set();
  function visit(id, seen, path) {
    if (id === 'B') { path.forEach(edge => live.add(edge.id)); return; }
    for (const edge of edges) {
      if (edge.from !== id && edge.to !== id) continue;
      const next = edge.from === id ? edge.to : edge.from;
      if (!seen.has(next)) visit(next, new Set([...seen, next]), [...path, edge]);
    }
  }
  visit('A', new Set(['A']), []);
  edges = edges.filter(edge => live.has(edge.id));
  let changed = true;
  while (changed) {
    changed = false;
    const dead = new Set(nodes.filter(node => !node.terminal && edges.filter(edge => edge.from === node.id || edge.to === node.id).length < 2).map(node => node.id));
    if (dead.size) {
      nodes = nodes.filter(node => !dead.has(node.id));
      edges = edges.filter(edge => !dead.has(edge.from) && !dead.has(edge.to));
      changed = true;
    }
  }
  return { nodes, edges };
}
const reversed = route => [...route].reverse();
export function prepareReduction(exercise, ids, rule) {
  const integrity = inspectExercise(exercise);
  if (!integrity.valid) return integrity;
  if (!Array.isArray(ids)) return { valid: false, status: 'interface', kind: 'interface', code: 'invalid-selection-shape', message: 'Volvé a seleccionar los componentes del circuito.' };
  if (rule === 'delete') {
    const edge = exercise.edges.find(item => item.id === ids[0]);
    return ids.length === 1 && edge?.compType === 'S' && edge.switchState === 'open'
      ? { valid: true, status: 'valid', code: 'remove-open-switch', value: OPEN, selected: [edge] }
      : { valid: false, status: 'interface', kind: 'interface', code: 'open-switch-selection-required', message: 'Seleccioná un interruptor abierto para eliminarlo.' };
  }
  const result = validateTopology(exercise.nodes, exercise.edges, ids, rule);
  if (!result.valid) return result;
  const selected = result.orderedEdges;
  const verified = verifyTopologyCertificate(exercise.nodes, exercise.edges, ids, rule, result.certificate);
  if (!verified.valid) return { ...verified, kind: 'fault' };
  if (selected.some(edge => edge.compType !== exercise.settings.compType && edge.compType !== 'W' && edge.compType !== 'S')) {
    return exerciseFault('mixed-component-types', 'La selección mezcla magnitudes que no se pueden combinar en este ejercicio.');
  }
  if (selected.some(edge => edge.compType === 'S' && edge.switchState === 'open')) {
    return { valid: false, status: 'prerequisite', kind: 'prerequisite', code: 'open-switch-first', message: 'Eliminá primero el interruptor abierto; esa rama no conduce.' };
  }
  return { ...result, selected, value: combineValues(selected.map(edge => edge.value), rule, exercise.settings.compType) };
}
export function reduceExercise(exercise, ids, rule) {
  const check = prepareReduction(exercise, ids, rule);
  if (!check.valid) return { ...check, exercise };
  let nodes = exercise.nodes, edges = exercise.edges.filter(edge => !ids.includes(edge.id));
  let equivalent = null;
  if (rule === 'delete') ({ nodes, edges } = prune(nodes, edges));
  else {
    const selected = check.selected;
    let from, to, route;
    if (rule === 'series') {
      from = check.pathNodes[0]; to = check.pathNodes.at(-1); route = [];
      selected.forEach((edge, index) => {
        const part = edge.from === check.pathNodes[index] ? edge.route : reversed(edge.route);
        if (route.length) route.push(...routeBetweenPorts(exercise, check.pathNodes[index], route.at(-1), part[0]).slice(1));
        route.push(...part.slice(route.length ? 1 : 0));
      });
      nodes = nodes.filter(node => !check.internalNodeIds.includes(node.id));
    } else {
      // Keep an existing branch, so the new component stays inside the selected region.
      const kept = [...selected].sort((a, b) => a.route.length - b.route.length || a.id.localeCompare(b.id))[0];
      from = kept.from; to = kept.to; route = kept.route;
    }
    equivalent = { id: `eq${exercise.nextEquivalent}`, label: `Eq${exercise.nextEquivalent}`, from, to, route, value: check.value, val: numericValue(check.value, exercise.settings.compType), compType: check.value.kind === 'wire' || (exercise.settings.compType === 'R' && check.value.n === '0') ? 'W' : exercise.settings.compType, equivalent: true,
      origin: { rule, components: selected.map(edge => ({ id: edge.id, label: edge.label, value: edge.value, origin: edge.origin })) } };
    edges.push(equivalent);
  }
  const liveNodeIds = new Set(nodes.map(node => node.id));
  const next = { ...exercise, nodes, edges, buses: exercise.buses.filter(bus => liveNodeIds.has(bus.id)), revision: exercise.revision + 1, nextEquivalent: exercise.nextEquivalent + (equivalent ? 1 : 0) };
  const integrity = inspectExercise(next);
  if (!integrity.valid) return { ...integrity, exercise };
  return { valid: true, exercise: next, equivalent, selected: check.selected, rule };
}
export function isComplete(exercise) {
  return exercise.edges.length === 1 && new Set([exercise.edges[0].from, exercise.edges[0].to]).has('A') && new Set([exercise.edges[0].from, exercise.edges[0].to]).has('B');
}
export { astToNetwork };

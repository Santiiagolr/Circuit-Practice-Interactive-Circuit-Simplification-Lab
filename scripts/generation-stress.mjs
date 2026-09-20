import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  combineNodes,
  generateBasicExercise,
  validateSelection,
} from '../src/lib/circuit.js';
import {
  combineGraphEdges,
  deleteGraphEdge,
  generateGridCircuit,
  getGraphGeometryIssues,
  isSolvable,
  validateGraphSelection,
} from '../src/lib/graphCircuit.js';
import { evaluateGraphNetwork, evaluateTree, expectClose } from '../tests/helpers/oracle.js';

const seedsPerCombination = Number(process.env.STRESS_SEEDS || 100);
const generationTimes = [];
let generated = 0;
let reductions = 0;

function collectTreeIds(node, result = []) {
  result.push(node.id);
  node.children?.forEach((child) => collectTreeIds(child, result));
  return result;
}

function findTreeMove(node) {
  if (node.type === 'leaf') return null;
  for (const child of node.children) {
    const nested = findTreeMove(child);
    if (nested) return nested;
  }
  const leaves = node.children.filter((child) => child.type === 'leaf');
  return leaves.length >= 2 ? { ids: leaves.map((child) => child.id), action: node.type } : null;
}

function reduceTree(tree, compType, expected, context) {
  let current = tree;
  for (let guard = 0; current.type !== 'leaf' && guard < 200; guard += 1) {
    const ids = collectTreeIds(current);
    assert.equal(new Set(ids).size, ids.length, 'Los IDs del árbol deben ser únicos.');
    const move = findTreeMove(current);
    assert.ok(move, 'El árbol generado debe ofrecer un movimiento manual.');
    assert.equal(validateSelection(current, move.ids, move.action).valid, true);
    current = combineNodes(current, move.ids, move.action, compType);
    reductions += 1;
  }
  assert.equal(current.type, 'leaf');
  assert.ok(expectClose(current.val, expected), `Resultado básico incorrecto (${context}): ${current.val} != ${expected}`);
}

function samePair(first, second) {
  return [first.from, first.to].sort().join(':') === [second.from, second.to].sort().join(':');
}

function findGraphMove(nodes, edges) {
  for (let first = 0; first < edges.length; first += 1) {
    for (let second = first + 1; second < edges.length; second += 1) {
      if (samePair(edges[first], edges[second])) {
        return { ids: [edges[first].id, edges[second].id], action: 'parallel' };
      }
    }
  }
  for (const node of nodes) {
    if (node.terminal) continue;
    const attached = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
    if (attached.length !== 2) continue;
    const other = attached.map((edge) => edge.from === node.id ? edge.to : edge.from);
    if (other[0] !== other[1]) return { ids: attached.map((edge) => edge.id), action: 'series' };
  }
  return null;
}

function assertGraphIntegrity(nodes, edges) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  assert.equal(nodeIds.size, nodes.length, 'Los IDs de nodos deben ser únicos.');
  assert.equal(new Set(edges.map((edge) => edge.id)).size, edges.length, 'Los IDs de componentes deben ser únicos.');
  edges.forEach((edge) => {
    assert.ok(nodeIds.has(edge.from) && nodeIds.has(edge.to), 'Toda arista debe conectar nodos vivos.');
    assert.ok(Array.isArray(edge.route) && edge.route.length >= 2, 'Toda arista debe conservar una ruta.');
    assert.ok(edge.route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  });
}

function removeOpenSwitches(graph) {
  let current = { nodes: graph.nodes, edges: graph.edges };
  while (true) {
    const open = current.edges.find((edge) => edge.compType === 'S' && edge.switchState === 'open');
    if (!open) return current;
    current = deleteGraphEdge(current.nodes, current.edges, open.id);
  }
}

function reduceGraph(graph, compType) {
  let current = removeOpenSwitches(graph);
  const expected = evaluateGraphNetwork(current.nodes, current.edges, compType);
  assert.ok(current.edges.length > 0, 'La poda no puede eliminar el circuito principal.');
  assert.equal(isSolvable(current.nodes, current.edges), true);
  for (let guard = 0; current.edges.length > 1 && guard < 400; guard += 1) {
    assertGraphIntegrity(current.nodes, current.edges);
    const move = findGraphMove(current.nodes, current.edges);
    assert.ok(move, 'El grafo generado debe ofrecer un movimiento manual.');
    const validation = validateGraphSelection(current.nodes, current.edges, move.ids, move.action);
    assert.equal(validation.valid, true, validation.message);
    current = combineGraphEdges(current.nodes, current.edges, move.ids, move.action, compType);
    reductions += 1;
  }
  assert.equal(current.edges.length, 1);
  assert.ok(expectClose(current.edges[0].val, expected), `Resultado avanzado incorrecto: ${current.edges[0].val} != ${expected}`);
}

for (const compType of ['R', 'C']) {
  for (const difficulty of ['guided', 'practice', 'challenge']) {
    for (const valueMode of ['varied', 'equal']) {
      const basicSignatures = new Set();
      const advancedSignatures = new Set();
      for (let seed = 0; seed < seedsPerCombination; seed += 1) {
        const baseSeed = `stress:${compType}:${difficulty}:${valueMode}:${seed}`;
        let started = performance.now();
        const basic = generateBasicExercise(compType, { difficulty, valueMode, seed: baseSeed });
        generationTimes.push(performance.now() - started);
        reduceTree(basic.tree, compType, evaluateTree(basic.tree, compType), baseSeed);
        basicSignatures.add(basic.signature);
        generated += 1;

        started = performance.now();
        const graph = generateGridCircuit(compType, valueMode, { difficulty, seed: baseSeed });
        generationTimes.push(performance.now() - started);
        assert.deepEqual(getGraphGeometryIssues(graph), [], 'La geometría inicial debe ser inequívoca.');
        reduceGraph(graph, compType);
        advancedSignatures.add(graph.signature);
        generated += 1;
      }
      const diversityFloor = Math.min(20, Math.floor(seedsPerCombination * 0.35));
      assert.ok(basicSignatures.size >= diversityFloor, `Baja diversidad básica: ${compType}/${difficulty}/${valueMode}`);
      assert.ok(advancedSignatures.size >= diversityFloor, `Baja diversidad avanzada: ${compType}/${difficulty}/${valueMode}`);
    }
  }
}

const sortedTimes = generationTimes.slice(10).sort((a, b) => a - b);
const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
assert.ok(p95 < 50, `La generación p95 debe ser <50 ms; fue ${p95.toFixed(2)} ms.`);
console.log(`Generation stress passed: ${generated} circuits, ${reductions} reductions.`);
console.log(`Generation p95: ${p95.toFixed(2)} ms (${seedsPerCombination} seeds per combination).`);

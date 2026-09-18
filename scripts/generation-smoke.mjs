import assert from 'node:assert/strict';
import {
  DIFFICULTY_PRESETS,
  combineNodes,
  generateBasicExercise,
  getTreeStats,
  validateSelection,
} from '../src/lib/circuit.js';
import {
  combineGraphEdges,
  deleteGraphEdge,
  generateGridCircuit,
  isSolvable,
  validateGraphSelection,
} from '../src/lib/graphCircuit.js';

function findTreeMove(node) {
  if (node.type === 'leaf') return null;

  for (const child of node.children) {
    const nested = findTreeMove(child);
    if (nested) return nested;
  }

  const leaves = node.children.filter((child) => child.type === 'leaf');
  return leaves.length >= 2
    ? { ids: leaves.slice(0, 2).map((child) => child.id), action: node.type }
    : null;
}

function reduceTree(tree, compType) {
  let current = tree;
  let guard = 0;

  while (current.type !== 'leaf' && guard < 200) {
    const move = findTreeMove(current);
    assert.ok(move, 'El árbol debe ofrecer una reducción válida.');
    const result = validateSelection(current, move.ids, move.action);
    assert.equal(result.valid, true, result.message);
    current = combineNodes(current, move.ids, move.action, compType);
    guard += 1;
  }

  assert.equal(current.type, 'leaf', 'El árbol debe terminar en un componente equivalente.');
  return current;
}

function samePair(first, second) {
  return [first.from, first.to].sort().join(':') === [second.from, second.to].sort().join(':');
}

{
  const nodes = [
    { id: 'A', x: 0, y: 0, terminal: true },
    { id: 'N1', x: 1, y: 0 },
    { id: 'N2', x: 2, y: 0 },
    { id: 'N3', x: 3, y: 0 },
    { id: 'B', x: 4, y: 0, terminal: true },
  ];
  const edges = [
    { id: 'E1', from: 'A', to: 'N1', val: 10, compType: 'R', route: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    { id: 'E2', from: 'N1', to: 'N2', val: 10, compType: 'R', route: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
    { id: 'E3', from: 'N2', to: 'N3', val: 10, compType: 'R', route: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    { id: 'E4', from: 'N3', to: 'B', val: 10, compType: 'R', route: [{ x: 3, y: 0 }, { x: 4, y: 0 }] },
  ];
  const ids = ['E3', 'E1', 'E4', 'E2'];
  const validation = validateGraphSelection(nodes, edges, ids, 'series');
  assert.equal(validation.valid, true, validation.message);
  const combined = combineGraphEdges(nodes, edges, ids, 'series', 'R');
  assert.equal(combined.edges.length, 1, 'Cuatro resistencias en serie deben combinarse en un solo paso.');
  assert.equal(combined.edges[0].val, 40);
  assert.deepEqual(new Set([combined.edges[0].from, combined.edges[0].to]), new Set(['A', 'B']));
  assert.deepEqual(combined.nodes.map((node) => node.id).sort(), ['A', 'B']);
}

function reduceGraph(nodes, edges, compType) {
  let currentNodes = nodes;
  let currentEdges = edges;
  let guard = 0;

  while (currentEdges.length > 1 && guard < 400) {
    let move = null;

    for (let firstIndex = 0; firstIndex < currentEdges.length && !move; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < currentEdges.length; secondIndex += 1) {
        if (samePair(currentEdges[firstIndex], currentEdges[secondIndex])) {
          move = {
            ids: [currentEdges[firstIndex].id, currentEdges[secondIndex].id],
            action: 'parallel',
          };
          break;
        }
      }
    }

    if (!move) {
      for (const node of currentNodes) {
        if (node.terminal) continue;
        const attached = currentEdges.filter((edge) => edge.from === node.id || edge.to === node.id);
        if (attached.length !== 2) continue;

        const neighbours = attached.map((edge) => edge.from === node.id ? edge.to : edge.from);
        if (neighbours[0] !== neighbours[1]) {
          move = { ids: attached.map((edge) => edge.id), action: 'series' };
          break;
        }
      }
    }

    assert.ok(move, 'El grafo debe ofrecer una reducción válida.');
    const result = validateGraphSelection(currentNodes, currentEdges, move.ids, move.action);
    assert.equal(result.valid, true, result.message);
    const next = combineGraphEdges(currentNodes, currentEdges, move.ids, move.action, compType);
    currentNodes = next.nodes;
    currentEdges = next.edges;
    assert.ok(currentEdges.every((edge) => (
      Array.isArray(edge.route)
      && edge.route.length >= 2
      && edge.route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    )), 'La reducción debe conservar una ruta renderizable.');
    guard += 1;
  }

  assert.equal(currentEdges.length, 1, 'El grafo debe terminar en un único elemento.');
  assert.deepEqual(new Set([currentEdges[0].from, currentEdges[0].to]), new Set(['A', 'B']));
  return currentEdges[0];
}

let basicVariants = 0;
let graphVariants = 0;
let openSwitches = 0;

for (const difficulty of Object.keys(DIFFICULTY_PRESETS)) {
  for (const compType of ['R', 'C']) {
    const basicSignatures = new Set();
    const graphSignatures = new Set();

    for (let index = 0; index < 48; index += 1) {
      const basic = generateBasicExercise(compType, {
        difficulty,
        seed: 'smoke:basic:' + difficulty + ':' + compType + ':' + index,
      });
      assert.ok(getTreeStats(basic.tree).leaves >= DIFFICULTY_PRESETS[difficulty].basic.minLeaves);
      reduceTree(basic.tree, compType);
      basicSignatures.add(basic.signature);

      const graph = generateGridCircuit(compType, 'varied', {
        difficulty,
        seed: 'smoke:graph:' + difficulty + ':' + compType + ':' + index,
      });
      assert.ok(graph);
      assert.equal(isSolvable(graph.nodes, graph.edges), true);
      assert.ok(graph.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
      assert.ok(Array.isArray(graph.sourceRoute) && graph.sourceRoute.length >= 2);
      assert.ok(Array.isArray(graph.equivalentRoute) && graph.equivalentRoute.length >= 2);
      assert.ok(graph.edges.every((edge) => (
        Array.isArray(edge.route)
        && edge.route.length >= 2
        && edge.route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        && ['orthogonal', 'diagonal'].includes(edge.routeKind)
      )));
      assert.ok(graph.edges.every((edge) => (
        ['horizontal', 'vertical', 'diagonal'].includes(edge.routeStyle)
      )));
      reduceGraph(graph.nodes, graph.edges, compType);
      graphSignatures.add(graph.signature);

      for (const edge of graph.edges) {
        if (edge.compType !== 'S' || edge.switchState !== 'open') continue;
        openSwitches += 1;
        const afterDelete = deleteGraphEdge(graph.nodes, graph.edges, edge.id);
        assert.ok(afterDelete.edges.length > 0);
        if (afterDelete.edges.length > 1) {
          assert.equal(isSolvable(afterDelete.nodes, afterDelete.edges), true);
        }
      }
    }

    assert.ok(basicSignatures.size >= 12, difficulty + ' ' + compType + ' básico demasiado repetitivo.');
    assert.ok(graphSignatures.size >= 12, difficulty + ' ' + compType + ' avanzado demasiado repetitivo.');
    basicVariants += basicSignatures.size;
    graphVariants += graphSignatures.size;
  }
}

console.log('Circuit generation smoke passed.');
console.log('Unique basic signatures:', basicVariants);
console.log('Unique advanced signatures:', graphVariants);
console.log('Open-switch deletion cases:', openSwitches);

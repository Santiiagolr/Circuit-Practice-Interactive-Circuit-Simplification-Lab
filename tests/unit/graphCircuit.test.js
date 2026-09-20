import { describe, expect, it } from 'vitest';
import {
  combineGraphEdges,
  deleteGraphEdge,
  getGraphGeometryIssues,
  validateGraphSelection,
} from '../../src/lib/graphCircuit';

const nodes = [
  { id: 'A', x: 0, y: 0, terminal: 'A' },
  { id: 'N1', x: 1, y: 0 },
  { id: 'N2', x: 2, y: 0 },
  { id: 'N3', x: 3, y: 0 },
  { id: 'B', x: 4, y: 0, terminal: 'B' },
];
const edge = (id, from, to, val = 10) => ({
  id, from, to, val, compType: 'R', label: id,
  route: [nodes.find((node) => node.id === from), nodes.find((node) => node.id === to)].map(({ x, y }) => ({ x, y })),
});

describe('graph topology validation', () => {
  it('accepts a 2-to-N series chain in arbitrary order', () => {
    const edges = [edge('e1', 'A', 'N1'), edge('e2', 'N1', 'N2'), edge('e3', 'N2', 'N3'), edge('e4', 'N3', 'B')];
    const ids = ['e3', 'e1', 'e4', 'e2'];
    expect(validateGraphSelection(nodes, edges, ids, 'series').valid).toBe(true);
    const result = combineGraphEdges(nodes, edges, ids, 'series', 'R');
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].val).toBe(40);
    expect(new Set([result.edges[0].from, result.edges[0].to])).toEqual(new Set(['A', 'B']));
  });

  it('only accepts exact parallel endpoints', () => {
    const edges = [edge('e1', 'A', 'B', 10), edge('e2', 'B', 'A', 20), edge('e3', 'A', 'N1', 30)];
    expect(validateGraphSelection(nodes, edges, ['e1', 'e2'], 'parallel').valid).toBe(true);
    expect(validateGraphSelection(nodes, edges, ['e1', 'e3'], 'parallel').valid).toBe(false);
  });

  it('rejects stale IDs, branches and chains through a terminal', () => {
    const branched = [edge('e1', 'A', 'N1'), edge('e2', 'N1', 'N2'), edge('e3', 'N1', 'B')];
    expect(validateGraphSelection(nodes, branched, ['e1', 'missing'], 'series').valid).toBe(false);
    expect(validateGraphSelection(nodes, branched, ['e1', 'e2', 'e3'], 'series').valid).toBe(false);
    const throughTerminal = [edge('e4', 'N1', 'A'), edge('e5', 'A', 'N2')];
    expect(validateGraphSelection(nodes, throughTerminal, ['e4', 'e5'], 'series').valid).toBe(false);
  });
});

it('prunes a dangling branch after deleting an open switch', () => {
  const edges = [
    edge('main', 'A', 'B', 20),
    { ...edge('switch', 'A', 'N1', Infinity), compType: 'S', switchState: 'open' },
    edge('dead', 'N1', 'N2', 30),
  ];
  const result = deleteGraphEdge(nodes, edges, 'switch');
  expect(result.edges.map((item) => item.id)).toEqual(['main']);
  expect(result.nodes.map((node) => node.id).sort()).toEqual(['A', 'B']);
});

it('reports detached routes and ambiguous crossings', () => {
  const graph = {
    nodes: [
      { id: 'A', x: 0, y: 0 }, { id: 'B', x: 2, y: 2 },
      { id: 'C', x: 0, y: 2 }, { id: 'D', x: 2, y: 0 },
    ],
    edges: [
      { id: 'x', from: 'A', to: 'B', route: [{ x: 0, y: 0 }, { x: 2, y: 2 }] },
      { id: 'y', from: 'C', to: 'D', route: [{ x: 0, y: 2 }, { x: 2, y: 0 }] },
      { id: 'z', from: 'A', to: 'B', route: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
    ],
  };
  const types = getGraphGeometryIssues(graph).map((issue) => issue.type);
  expect(types).toContain('cross');
  expect(types).toContain('detached-route');
});

import {
  calculateEquivalent,
  createSeededRandom,
  generateId,
  generateStructuredExercise,
  getDifficultyConfig,
  getTreeStats,
  topologySignature,
  formatValue as formatCircuitValue,
} from './circuit.js';

export function calcEq(compType, vals, mode) {
  return calculateEquivalent(compType, vals, mode);
}

export function formatValue(val, compType) {
  if (compType === 'W') return 'Cable';
  if (compType === 'S') return val === 0 ? 'Cerrado' : 'Abierto';
  return formatCircuitValue(val, compType);
}

function edgesMatch(first, second) {
  return (first.from === second.from && first.to === second.to)
    || (first.from === second.to && first.to === second.from);
}

function getNodeEdges(edges, nodeId) {
  return edges.filter((edge) => edge.from === nodeId || edge.to === nodeId);
}

function otherEnd(edge, nodeId) {
  return edge.from === nodeId ? edge.to : edge.from;
}

function isTerminalEdge(edge) {
  const endpoints = new Set([edge.from, edge.to]);
  return edge.from !== edge.to && endpoints.has('A') && endpoints.has('B');
}

export function isSolvable(nodesIn, edgesIn) {
  let nodes = nodesIn.map((node) => ({ ...node }));
  let edges = edgesIn.map((edge) => ({ ...edge }));
  let changed = true;

  while (changed && edges.length > 1) {
    changed = false;

    // Two edges with the same endpoints are always a parallel reduction.
    for (let firstIndex = 0; firstIndex < edges.length && !changed; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
        if (edgesMatch(edges[firstIndex], edges[secondIndex])) {
          edges.splice(secondIndex, 1);
          changed = true;
          break;
        }
      }
    }
    if (changed) continue;

    // A non-terminal node with exactly two distinct neighbours is a series reduction.
    for (const node of nodes) {
      if (node.terminal) continue;
      const connectedEdges = getNodeEdges(edges, node.id);
      if (connectedEdges.length !== 2) continue;

      const [firstEdge, secondEdge] = connectedEdges;
      const firstEnd = otherEnd(firstEdge, node.id);
      const secondEnd = otherEnd(secondEdge, node.id);
      if (firstEnd === secondEnd) continue;

      firstEdge.from = firstEnd;
      firstEdge.to = secondEnd;
      edges = edges.filter((edge) => edge.id !== secondEdge.id);
      nodes = nodes.filter((candidate) => candidate.id !== node.id);
      changed = true;
      break;
    }

    nodes = nodes.filter((node) => node.terminal || getNodeEdges(edges, node.id).length > 0);
  }

  return edges.length === 1 && isTerminalEdge(edges[0]);
}

export function validateGraphSelection(nodes, edges, selectedIds, action) {
  if (selectedIds.length < 2) {
    return { valid: false, message: 'Seleccioná al menos 2 componentes.' };
  }

  const selected = edges.filter((edge) => selectedIds.includes(edge.id));
  if (selected.length !== selectedIds.length) {
    return { valid: false, message: 'La selección ya no pertenece al circuito actual.' };
  }

  if (action === 'parallel') {
    const reference = selected[0];
    const referencePair = [reference.from, reference.to].sort().join('::');
    const allMatch = selected.every((edge) => (
      [edge.from, edge.to].sort().join('::') === referencePair
    ));

    return allMatch
      ? { valid: true }
      : {
          valid: false,
          message: 'Para paralelo, todos deben conectar exactamente los mismos dos nodos.',
        };
  }

  if (action === 'series') {
    if (selected.length !== 2) {
      return { valid: false, message: 'Para serie, seleccioná exactamente 2 componentes.' };
    }

    const [first, second] = selected;
    const sharedNodes = [first.from, first.to].filter((nodeId) => (
      nodeId === second.from || nodeId === second.to
    ));

    if (sharedNodes.length !== 1) {
      return {
        valid: false,
        message: 'Para serie deben compartir un único nodo intermedio; si comparten dos, están en paralelo.',
      };
    }

    const sharedNode = sharedNodes[0];
    const node = nodes.find((candidate) => candidate.id === sharedNode);
    if (!node) {
      return { valid: false, message: 'El nodo compartido ya no existe.' };
    }
    if (node.terminal) {
      return {
        valid: false,
        message: 'El nodo compartido es un terminal de la batería; no se combinan en serie por allí.',
      };
    }

    const degree = getNodeEdges(edges, sharedNode).length;
    if (degree !== 2) {
      return {
        valid: false,
        message: 'El nodo compartido tiene ' + degree + ' conexiones. Para serie debe tener exactamente 2.',
      };
    }

    return { valid: true, sharedNode };
  }

  return { valid: false, message: 'Acción no reconocida.' };
}

export function combineGraphEdges(nodes, edges, selectedIds, action, compType) {
  const newNodes = nodes.map((node) => ({ ...node }));
  let newEdges = edges.map((edge) => ({ ...edge }));
  const selected = newEdges.filter((edge) => selectedIds.includes(edge.id));

  if (action === 'parallel') {
    const equivalent = calcEq(compType, selected.map((edge) => edge.val), 'parallel');
    const isWire = (compType === 'R' && equivalent === 0)
      || (compType === 'C' && equivalent === Infinity);
    const kept = selected[0];
    kept.val = equivalent;
    kept.compType = isWire ? 'W' : compType;
    kept.label = isWire ? 'W' : 'Eq';
    kept.id = generateId();
    const removeIds = selected.slice(1).map((edge) => edge.id);
    newEdges = newEdges.filter((edge) => !removeIds.includes(edge.id));
  } else if (action === 'series') {
    const [first, second] = selected;
    const sharedNode = [first.from, first.to].find((nodeId) => (
      nodeId === second.from || nodeId === second.to
    ));
    const firstEnd = otherEnd(first, sharedNode);
    const secondEnd = otherEnd(second, sharedNode);

    if (!sharedNode || firstEnd === secondEnd) {
      return { nodes, edges };
    }

    const equivalent = calcEq(compType, [first.val, second.val], 'series');
    const isWire = (compType === 'R' && equivalent === 0)
      || (compType === 'C' && equivalent === Infinity);
    first.from = firstEnd;
    first.to = secondEnd;
    first.val = equivalent;
    first.compType = isWire ? 'W' : compType;
    first.label = isWire ? 'W' : 'Eq';
    first.id = generateId();
    newEdges = newEdges.filter((edge) => edge.id !== second.id);
    return {
      nodes: newNodes.filter((node) => node.id !== sharedNode),
      edges: newEdges,
    };
  }

  return { nodes: newNodes, edges: newEdges };
}

export function deleteGraphEdge(nodes, edges, edgeId) {
  let newNodes = nodes.map((node) => ({ ...node }));
  let newEdges = edges.filter((edge) => edge.id !== edgeId);
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of newNodes) {
      if (node.terminal) continue;
      const connectedEdges = getNodeEdges(newEdges, node.id);

      if (connectedEdges.length <= 1) {
        if (connectedEdges.length === 1) {
          newEdges = newEdges.filter((edge) => edge.id !== connectedEdges[0].id);
        }
        newNodes = newNodes.filter((candidate) => candidate.id !== node.id);
        changed = true;
        break;
      }
    }
  }

  return { nodes: newNodes, edges: newEdges };
}

function findSwitchCandidates(node, candidates = []) {
  if (node.type === 'leaf') return candidates;

  if (node.type === 'parallel') {
    node.children.forEach((child) => {
      if (child.type === 'leaf') candidates.push(child.id);
      findSwitchCandidates(child, candidates);
    });
  } else {
    node.children.forEach((child) => findSwitchCandidates(child, candidates));
  }

  return candidates;
}

function markSwitch(node, targetId, switchState) {
  if (node.type === 'leaf') {
    if (node.id === targetId) {
      node.compType = 'S';
      node.switchState = switchState;
    }
    return;
  }

  node.children.forEach((child) => markSwitch(child, targetId, switchState));
}

function getTreeHeight(node, branchGap) {
  if (node.type === 'leaf') return 1;

  const childHeights = node.children.map((child) => getTreeHeight(child, branchGap));
  if (node.type === 'series') return Math.max(...childHeights);

  return childHeights.reduce((sum, height) => sum + height, 0)
    + branchGap * Math.max(0, node.children.length - 1);
}

function chooseRouteStyle(edgeIndex, depth, layoutVariant) {
  const pattern = (edgeIndex + depth + layoutVariant) % 6;
  if (pattern === 0 || (pattern === 3 && depth > 0)) return 'diagonal';
  return pattern % 2 === 0 ? 'horizontal' : 'vertical';
}

function createGraphFromTree(tree, compType, random) {
  const stats = getTreeStats(tree);
  const layoutVariant = Math.floor(random() * 4);
  const branchGap = layoutVariant % 2 === 0 ? 1 : 1.5;
  const span = Math.max(3, stats.leaves + stats.depth - 1);
  const nodes = [
    { id: 'A', x: 0, y: 0, terminal: 'A' },
    { id: 'B', x: span, y: 0, terminal: 'B' },
  ];
  const edges = [];
  let nodeCounter = 0;
  let edgeCounter = 0;
  let componentCounter = 1;

  function addNode(x, y) {
    const id = 'N' + nodeCounter++;
    nodes.push({ id, x, y });
    return id;
  }

  function addEdge(from, to, leaf, depth) {
    const isSwitch = leaf.compType === 'S';
    const isWire = leaf.compType === 'W';
    let value = leaf.val;

    if (isWire) value = compType === 'R' ? 0 : Infinity;
    if (isSwitch) {
      value = leaf.switchState === 'closed'
        ? compType === 'R' ? 0 : Infinity
        : compType === 'R' ? Infinity : 0;
    }

    edges.push({
      id: 'e' + edgeCounter,
      from,
      to,
      compType: leaf.compType,
      switchState: isSwitch ? leaf.switchState : undefined,
      val: value,
      label: isWire ? 'W' : isSwitch ? 'S' : compType + componentCounter++,
      routeStyle: chooseRouteStyle(edgeCounter, depth, layoutVariant),
    });
    edgeCounter += 1;
  }

  function convert(node, from, to, startX, endX, centerY, depth) {
    if (node.type === 'leaf') {
      addEdge(from, to, node, depth);
      return;
    }

    if (node.type === 'series') {
      const segment = (endX - startX) / node.children.length;
      let childFrom = from;

      node.children.forEach((child, index) => {
        const childStartX = startX + segment * index;
        const childEndX = startX + segment * (index + 1);
        const childTo = index === node.children.length - 1
          ? to
          : addNode(childEndX, centerY);
        convert(child, childFrom, childTo, childStartX, childEndX, centerY, depth + 1);
        childFrom = childTo;
      });
      return;
    }

    const childHeights = node.children.map((child) => getTreeHeight(child, branchGap));
    const totalHeight = childHeights.reduce((sum, height) => sum + height, 0)
      + branchGap * Math.max(0, node.children.length - 1);
    let cursor = centerY - totalHeight / 2;

    node.children.forEach((child, index) => {
      const branchY = cursor + childHeights[index] / 2;
      convert(child, from, to, startX, endX, branchY, depth + 1);
      cursor += childHeights[index] + branchGap;
    });
  }

  convert(tree, 'A', 'B', 0, span, 0, 0);

  if (random() > 0.5) {
    nodes.forEach((node) => {
      node.y *= -1;
    });
  }

  return { nodes, edges, stats, signature: topologySignature(tree), layoutVariant };
}

export function generateGridCircuit(compType, valueMode = 'varied', options = {}) {
  let resolvedValueMode = valueMode;
  let resolvedOptions = options;

  if (typeof valueMode === 'object') {
    resolvedOptions = valueMode;
    resolvedValueMode = valueMode.valueMode || 'varied';
  }

  const {
    difficulty = 'guided',
    seed = Date.now(),
    recentSignatures = [],
  } = resolvedOptions;
  const config = getDifficultyConfig('advanced', difficulty);
  let fallback = null;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const attemptSeed = String(seed) + ':advanced:' + difficulty + ':' + attempt;
    const exercise = generateStructuredExercise(compType, {
      mode: 'advanced',
      difficulty,
      seed: attemptSeed,
      valueMode: resolvedValueMode,
      recentSignatures,
    });
    const random = createSeededRandom(attemptSeed + ':graph');
    const candidates = findSwitchCandidates(exercise.tree);
    const switchChance = difficulty === 'challenge' ? 0.24 : difficulty === 'practice' ? 0.18 : 0.12;

    if (candidates.length > 0 && random() < switchChance) {
      const targetId = candidates[Math.floor(random() * candidates.length)];
      markSwitch(exercise.tree, targetId, random() > 0.5 ? 'open' : 'closed');
    }

    const graph = createGraphFromTree(exercise.tree, compType, random);
    fallback = {
      ...graph,
      seed: attemptSeed,
      config,
      signature: topologySignature(exercise.tree),
    };

    if (isSolvable(graph.nodes, graph.edges) && !recentSignatures.includes(fallback.signature)) {
      return fallback;
    }
  }

  return fallback;
}

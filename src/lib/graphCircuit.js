import {
  calculateEquivalent,
  createSeededRandom,
  formatValue as formatCircuitValue,
  generateId,
  getDifficultyConfig,
  topologySignature,
} from './circuit.js';

export function calcEq(compType, vals, mode) {
  return calculateEquivalent(compType, vals, mode);
}

export function formatValue(val, compType, switchState) {
  if (compType === 'W') return 'Cable';
  if (compType === 'S') {
    if (switchState) return switchState === 'open' ? 'Abierto' : 'Cerrado';
    return val === 0 ? 'Cerrado' : 'Abierto';
  }
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

function inspectSeriesChain(nodes, edges, selected) {
  const selectedByNode = new Map();

  for (const edge of selected) {
    if (edge.from === edge.to) {
      return { valid: false, message: 'Una conexión cerrada sobre el mismo nodo no forma una cadena en serie.' };
    }

    for (const nodeId of [edge.from, edge.to]) {
      const attached = selectedByNode.get(nodeId) || [];
      attached.push(edge);
      selectedByNode.set(nodeId, attached);
    }
  }

  const endpoints = [];
  for (const [nodeId, attached] of selectedByNode) {
    if (attached.length === 1) {
      endpoints.push(nodeId);
      continue;
    }
    if (attached.length !== 2) {
      return {
        valid: false,
        message: 'La selección se bifurca. Para serie debe formar una única cadena sin ramificaciones.',
      };
    }

    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return { valid: false, message: 'Uno de los nodos compartidos ya no existe.' };
    }
    if (node.terminal) {
      return {
        valid: false,
        message: 'La cadena atraviesa un terminal de la batería; no se combina en serie por allí.',
      };
    }

    const degree = getNodeEdges(edges, nodeId).length;
    if (degree !== 2) {
      return {
        valid: false,
        message: 'El nodo intermedio tiene ' + degree + ' conexiones. Para serie debe tener exactamente 2.',
      };
    }
  }

  if (endpoints.length !== 2) {
    return {
      valid: false,
      message: 'Para serie, la selección debe formar una cadena abierta y continua.',
    };
  }

  const orderedEdges = [];
  const pathNodes = [endpoints[0]];
  const visited = new Set();
  let currentNode = endpoints[0];

  while (orderedEdges.length < selected.length) {
    const nextEdge = (selectedByNode.get(currentNode) || [])
      .find((edge) => !visited.has(edge.id));
    if (!nextEdge) break;

    visited.add(nextEdge.id);
    orderedEdges.push(nextEdge);
    currentNode = otherEnd(nextEdge, currentNode);
    pathNodes.push(currentNode);
  }

  if (orderedEdges.length !== selected.length || currentNode !== endpoints[1]) {
    return {
      valid: false,
      message: 'Los componentes seleccionados no forman una única cadena continua en serie.',
    };
  }

  return {
    valid: true,
    orderedEdges,
    pathNodes,
    internalNodeIds: pathNodes.slice(1, -1),
  };
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

    // Dos aristas con los mismos extremos siempre pueden reducirse en paralelo.
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

    // Un nodo no terminal de grado 2 habilita una reducción en serie.
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
    return inspectSeriesChain(nodes, edges, selected);
  }

  return { valid: false, message: 'Acción no reconocida.' };
}

function compactPoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.x !== previous.x || point.y !== previous.y;
  });
}

function reverseRoute(route) {
  return [...route].reverse().map((point) => ({ ...point }));
}

function getNodePosition(nodes, nodeId) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  return node ? { x: node.x, y: node.y } : null;
}

function orientRoute(edge, startId, endId, nodes) {
  const route = Array.isArray(edge.route) ? compactPoints(edge.route) : [];
  if (edge.from === startId && edge.to === endId) return route;
  if (edge.from === endId && edge.to === startId) return reverseRoute(route);

  const start = getNodePosition(nodes, startId);
  const end = getNodePosition(nodes, endId);
  return start && end ? [start, end] : route;
}

function routeLength(route) {
  return route.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + Math.hypot(point.x - route[index - 1].x, point.y - route[index - 1].y);
  }, 0);
}

function routeBends(route) {
  return Math.max(0, route.length - 2);
}

function routeCenter(route) {
  const totals = route.reduce((result, point) => ({
    x: result.x + point.x,
    y: result.y + point.y,
  }), { x: 0, y: 0 });
  return route.length > 0
    ? { x: totals.x / route.length, y: totals.y / route.length }
    : { x: 0, y: 0 };
}

function chooseParallelRoute(selected) {
  const centers = selected
    .map((edge) => routeCenter(edge.route || []))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const target = centers.reduce((result, point) => ({
    x: result.x + point.x,
    y: result.y + point.y,
  }), { x: 0, y: 0 });
  if (centers.length > 0) {
    target.x /= centers.length;
    target.y /= centers.length;
  }

  return selected
    .map((edge) => {
      const route = compactPoints(edge.route || []);
      const center = routeCenter(route);
      return {
        route,
        score: routeLength(route) + routeBends(route) * 2
          + Math.hypot(center.x - target.x, center.y - target.y),
      };
    })
    .sort((first, second) => first.score - second.score)[0]?.route || [];
}

function getRouteKind(route) {
  const hasDiagonal = route.some((point, index) => {
    if (index === 0) return false;
    const previous = route[index - 1];
    return point.x !== previous.x && point.y !== previous.y;
  });
  return hasDiagonal ? 'diagonal' : 'orthogonal';
}

function getRouteStyle(route) {
  let longest = 0;
  let style = 'horizontal';

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const length = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (length > longest) {
      longest = length;
      style = Math.abs(current.x - previous.x) >= Math.abs(current.y - previous.y)
        ? 'horizontal'
        : 'vertical';
    }
  }

  return style;
}

export function combineGraphEdges(nodes, edges, selectedIds, action, compType) {
  const newNodes = nodes.map((node) => ({ ...node }));
  let newEdges = edges.map((edge) => ({
    ...edge,
    route: Array.isArray(edge.route) ? edge.route.map((point) => ({ ...point })) : edge.route,
  }));
  const selected = newEdges.filter((edge) => selectedIds.includes(edge.id));

  if (selected.length < 2) return { nodes, edges };

  if (action === 'parallel') {
    const equivalent = calcEq(compType, selected.map((edge) => edge.val), 'parallel');
    const isWire = (compType === 'R' && equivalent === 0)
      || (compType === 'C' && equivalent === Infinity);
    const kept = selected[0];
    const mergedRoute = chooseParallelRoute(selected);
    kept.val = equivalent;
    kept.compType = isWire ? 'W' : compType;
    kept.label = isWire ? 'W' : 'Eq';
    kept.id = generateId();
    kept.route = mergedRoute;
    kept.routeKind = getRouteKind(mergedRoute);
    kept.routeStyle = kept.routeKind === 'diagonal' ? 'diagonal' : getRouteStyle(mergedRoute);
    kept.layoutRole = 'equivalent';
    const removeIds = selected.slice(1).map((edge) => edge.id);
    newEdges = newEdges.filter((edge) => !removeIds.includes(edge.id));
  } else if (action === 'series') {
    const chain = inspectSeriesChain(newNodes, newEdges, selected);
    if (!chain.valid) return { nodes, edges };

    const { orderedEdges, pathNodes, internalNodeIds } = chain;
    const selectedEdgeIds = new Set(orderedEdges.map((edge) => edge.id));
    const mergedRoute = compactPoints(orderedEdges.flatMap((edge, index) => {
      const route = orientRoute(edge, pathNodes[index], pathNodes[index + 1], newNodes);
      return index === 0 ? route : route.slice(1);
    }));
    const equivalent = calcEq(compType, orderedEdges.map((edge) => edge.val), 'series');
    const isWire = (compType === 'R' && equivalent === 0)
      || (compType === 'C' && equivalent === Infinity);
    const first = orderedEdges[0];
    first.from = pathNodes[0];
    first.to = pathNodes[pathNodes.length - 1];
    first.val = equivalent;
    first.compType = isWire ? 'W' : compType;
    first.label = isWire ? 'W' : 'Eq';
    first.id = generateId();
    first.route = mergedRoute;
    first.routeKind = getRouteKind(mergedRoute);
    first.routeStyle = first.routeKind === 'diagonal' ? 'diagonal' : getRouteStyle(mergedRoute);
    first.layoutRole = 'equivalent';
    newEdges = newEdges.filter((edge) => edge === first || !selectedEdgeIds.has(edge.id));
    const internalNodeSet = new Set(internalNodeIds);
    return {
      nodes: newNodes.filter((node) => !internalNodeSet.has(node.id)),
      edges: newEdges,
    };
  }

  return { nodes: newNodes, edges: newEdges };
}

export function deleteGraphEdge(nodes, edges, edgeId) {
  let newNodes = nodes.map((node) => ({ ...node }));
  let newEdges = edges
    .filter((edge) => edge.id !== edgeId)
    .map((edge) => ({
      ...edge,
      route: Array.isArray(edge.route) ? edge.route.map((point) => ({ ...point })) : edge.route,
    }));
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

export const ADVANCED_LAYOUT_FAMILIES = {
  'rail-ladder': {
    label: 'Escalera de rieles',
    diagonals: 0,
    roots: ['parallel', 'series'],
  },
  'frame-crossbar': {
    label: 'Marco con travesaño',
    diagonals: 1,
    roots: ['parallel', 'series'],
  },
  'boxed-diagonal': {
    label: 'Caja con diagonal',
    diagonals: 1,
    roots: ['parallel'],
  },
  'stacked-cells': {
    label: 'Celdas apiladas',
    diagonals: 2,
    roots: ['series'],
  },
  'bridge-fan': {
    label: 'Marco convergente',
    diagonals: 1,
    roots: ['parallel'],
  },
  'parallel-rails': {
    label: 'Rieles paralelos',
    diagonals: 0,
    roots: ['parallel'],
  },
};

const FAMILIES_BY_DIFFICULTY = {
  guided: ['rail-ladder', 'parallel-rails', 'frame-crossbar'],
  practice: ['rail-ladder', 'frame-crossbar', 'boxed-diagonal', 'parallel-rails', 'stacked-cells'],
  challenge: Object.keys(ADVANCED_LAYOUT_FAMILIES),
};

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function splitBudget(total, parts, minimum, random) {
  const budgets = Array.from({ length: parts }, () => minimum);
  let remaining = total - minimum * parts;

  while (remaining > 0) {
    budgets[randomInt(random, 0, parts - 1)] += 1;
    remaining -= 1;
  }

  return shuffle(budgets, random);
}

function chooseNodeType(family, parentType, depth, config, random) {
  const familyConfig = ADVANCED_LAYOUT_FAMILIES[family];
  if (!parentType) {
    const roots = familyConfig.roots;
    return roots[randomInt(random, 0, roots.length - 1)];
  }

  if (depth >= config.maxDepth - 1) return 'series';
  if (parentType === 'parallel') {
    return random() < 0.82 ? 'series' : 'parallel';
  }
  return random() < 0.76 ? 'parallel' : 'series';
}

function createTopologyLeaf(compType, config, random, nextId, valueMode) {
  const isWire = random() < config.wireChance;
  const value = valueMode === 'equal'
    ? 30
    : [10, 20, 30, 40, 50, 60][randomInt(random, 0, 5)];

  return {
    type: 'leaf',
    id: nextId(),
    compType: isWire ? 'W' : compType,
    val: isWire ? (compType === 'R' ? 0 : Infinity) : value,
    label: isWire ? 'W' : compType,
  };
}

function buildTopology({ compType, config, family, random, nextId, valueMode }, remaining, depth = 0, parentType = null) {
  if (remaining <= 1) {
    return createTopologyLeaf(compType, config, random, nextId, valueMode);
  }

  if (depth >= config.maxDepth) {
    return {
      type: 'series',
      id: nextId(),
      children: Array.from({ length: remaining }, () => (
        createTopologyLeaf(compType, config, random, nextId, valueMode)
      )),
    };
  }

  let type = chooseNodeType(family, parentType, depth, config, random);
  let childCount = type === 'parallel'
    ? (remaining >= 6 && random() < 0.3 ? 3 : 2)
    : (config.maxBranching >= 3 && remaining >= 3 && random() < 0.28 ? 3 : 2);
  const minimum = type === 'parallel' ? 2 : 1;

  if (remaining < childCount * minimum) {
    type = 'series';
    childCount = Math.min(2, remaining);
  }

  const budgets = splitBudget(remaining, childCount, type === 'parallel' ? 2 : 1, random);
  return {
    type,
    id: nextId(),
    children: budgets.map((budget) => buildTopology(
      { compType, config, family, random, nextId, valueMode },
      budget,
      depth + 1,
      type,
    )),
  };
}

function getTreeStats(node) {
  if (node.type === 'leaf') {
    return { leaves: 1, depth: 1, series: 0, parallel: 0 };
  }

  const children = node.children.map(getTreeStats);
  return {
    leaves: children.reduce((sum, item) => sum + item.leaves, 0),
    depth: 1 + Math.max(...children.map((item) => item.depth)),
    series: (node.type === 'series' ? 1 : 0) + children.reduce((sum, item) => sum + item.series, 0),
    parallel: (node.type === 'parallel' ? 1 : 0) + children.reduce((sum, item) => sum + item.parallel, 0),
  };
}

function measureTree(node) {
  if (node.type === 'leaf') return { width: 3, height: 1, leaves: 1 };

  const children = node.children.map(measureTree);
  if (node.type === 'series') {
    return {
      width: children.reduce((sum, item) => sum + item.width, 0),
      height: Math.max(...children.map((item) => item.height)),
      leaves: children.reduce((sum, item) => sum + item.leaves, 0),
    };
  }

  return {
    width: Math.max(...children.map((item) => item.width)) + 1,
    height: children.reduce((sum, item) => sum + item.height, 0) + 2 * Math.max(0, children.length - 1),
    leaves: children.reduce((sum, item) => sum + item.leaves, 0),
  };
}

function cleanRoute(route) {
  const compact = compactPoints(route);
  return compact.filter((point, index) => {
    if (index === 0 || index === compact.length - 1) return true;
    const previous = compact[index - 1];
    const next = compact[index + 1];
    const sameHorizontal = previous.y === point.y && point.y === next.y;
    const sameVertical = previous.x === point.x && point.x === next.x;
    return !sameHorizontal && !sameVertical;
  });
}

function orthogonalRoute(start, end, preference = 'horizontal') {
  if (start.x === end.x || start.y === end.y) return [start, end];

  if (preference === 'vertical') {
    const middleY = (start.y + end.y) / 2;
    return [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
  }

  const middleX = (start.x + end.x) / 2;
  return [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
}

function transformPoint(point, variant, bounds) {
  if (variant === 1) return { x: bounds.maxX - point.x, y: point.y };
  if (variant === 2) return { x: point.x, y: bounds.maxY - point.y };
  if (variant === 3) return { x: bounds.maxY - point.y, y: point.x };
  return { x: point.x, y: point.y };
}

function getBounds(points) {
  const valid = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (valid.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return {
    minX: Math.min(...valid.map((point) => point.x)),
    minY: Math.min(...valid.map((point) => point.y)),
    maxX: Math.max(...valid.map((point) => point.x)),
    maxY: Math.max(...valid.map((point) => point.y)),
  };
}

function collectGraphPoints(nodes, edges, sourceRoute, equivalentRoute) {
  return nodes.map((node) => ({ x: node.x, y: node.y }))
    .concat(edges.flatMap((edge) => edge.route || []))
    .concat(sourceRoute || [])
    .concat(equivalentRoute || []);
}

function normalizeGraphLayout(nodes, edges, sourceRoute, equivalentRoute, sourceSymbol) {
  const bounds = getBounds(collectGraphPoints(nodes, edges, sourceRoute, equivalentRoute));
  const move = (point) => ({ x: point.x - bounds.minX, y: point.y - bounds.minY });
  const nextNodes = nodes.map((node) => ({ ...node, x: node.x - bounds.minX, y: node.y - bounds.minY }));
  const nextEdges = edges.map((edge) => ({
    ...edge,
    route: (edge.route || []).map(move),
  }));
  const nextSourceRoute = (sourceRoute || []).map(move);
  const nextEquivalentRoute = (equivalentRoute || []).map(move);
  const nextSourceSymbol = sourceSymbol
    ? { ...move(sourceSymbol), angle: sourceSymbol.angle }
    : null;

  return {
    nodes: nextNodes,
    edges: nextEdges,
    sourceRoute: nextSourceRoute,
    equivalentRoute: nextEquivalentRoute,
    sourceSymbol: nextSourceSymbol,
    bounds: {
      width: Math.max(1, bounds.maxX - bounds.minX),
      height: Math.max(1, bounds.maxY - bounds.minY),
    },
  };
}

function transformGraphLayout(graph, variant) {
  const rawBounds = getBounds(collectGraphPoints(
    graph.nodes,
    graph.edges,
    graph.sourceRoute,
    graph.equivalentRoute,
  ));
  const point = (value) => transformPoint(value, variant, rawBounds);
  const nextNodes = graph.nodes.map((node) => ({ ...node, ...point(node) }));
  const nextEdges = graph.edges.map((edge) => ({
    ...edge,
    route: (edge.route || []).map(point),
  }));
  const nextSourceRoute = (graph.sourceRoute || []).map(point);
  const nextEquivalentRoute = (graph.equivalentRoute || []).map(point);
  const nextSourceSymbol = graph.sourceSymbol
    ? {
        ...point(graph.sourceSymbol),
        angle: variant === 3 ? 90 : 0,
      }
    : null;

  return normalizeGraphLayout(
    nextNodes,
    nextEdges,
    nextSourceRoute,
    nextEquivalentRoute,
    nextSourceSymbol,
  );
}

function createGraphFromTree(tree, compType, random, family, layoutVariant) {
  const metrics = measureTree(tree);
  const width = Math.max(8, metrics.width);
  const rootHeight = Math.max(5, metrics.height);
  const nodes = [
    { id: 'A', x: 0, y: 0, terminal: 'A' },
    { id: 'B', x: width, y: 0, terminal: 'B' },
  ];
  const nodePositions = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  let nodeCounter = 0;
  let edgeCounter = 0;
  let componentCounter = 1;
  const familyConfig = ADVANCED_LAYOUT_FAMILIES[family];
  const context = {
    diagonalBudget: familyConfig.diagonals,
    diagonalUsed: 0,
  };

  function addNode(x, y) {
    const id = 'N' + nodeCounter++;
    const node = { id, x, y };
    nodes.push(node);
    nodePositions.set(id, node);
    return id;
  }

  function shouldUseDiagonal(start, end, routeContext) {
    if (!routeContext.diagonalBranch || context.diagonalBudget <= context.diagonalUsed) return false;
    if (Math.abs(start.x - end.x) < 2 || Math.abs(start.y - end.y) < 1) return false;
    context.diagonalUsed += 1;
    return true;
  }

  function addEdge(from, to, leaf, routeContext) {
    const startNode = nodePositions.get(from);
    const endNode = nodePositions.get(to);
    if (!startNode || !endNode) return;

    const start = { x: startNode.x, y: startNode.y };
    const end = { x: endNode.x, y: endNode.y };
    let route;
    let routeKind = 'orthogonal';

    if (
      routeContext.directParallel
      && routeContext.branchY !== start.y
      && routeContext.branchY !== end.y
    ) {
      const inset = Math.min(1, Math.max(0.6, Math.abs(end.x - start.x) * 0.15));
      route = [
        start,
        { x: start.x + inset, y: routeContext.branchY },
        { x: end.x - inset, y: routeContext.branchY },
        end,
      ];
    } else if (shouldUseDiagonal(start, end, routeContext)) {
      route = [start, end];
      routeKind = 'diagonal';
    } else {
      route = orthogonalRoute(start, end, routeContext.preference);
    }

    const isSwitch = leaf.compType === 'S';
    const isWire = leaf.compType === 'W';
    const edge = {
      id: 'e' + edgeCounter,
      from,
      to,
      compType: leaf.compType,
      switchState: isSwitch ? leaf.switchState : undefined,
      val: isWire
        ? (compType === 'R' ? 0 : Infinity)
        : isSwitch
          ? leaf.switchState === 'closed'
            ? (compType === 'R' ? 0 : Infinity)
            : (compType === 'R' ? Infinity : 0)
          : leaf.val,
      label: isWire ? 'W' : isSwitch ? 'S' : compType + componentCounter++,
      route: cleanRoute(route),
      routeKind,
      routeStyle: routeKind === 'diagonal' ? 'diagonal' : getRouteStyle(route),
    };
    edges.push(edge);
    edgeCounter += 1;
  }

  function embed(node, from, to, x0, x1, centerY, routeContext) {
    if (node.type === 'leaf') {
      addEdge(from, to, node, {
        ...routeContext,
        branchY: routeContext.branchY ?? centerY,
      });
      return;
    }

    if (node.type === 'series') {
      const segment = (x1 - x0) / node.children.length;
      let childFrom = from;

      node.children.forEach((child, index) => {
        const childStartX = x0 + segment * index;
        const childEndX = x0 + segment * (index + 1);
        const childTo = index === node.children.length - 1
          ? to
          : addNode(childEndX, centerY);
        embed(child, childFrom, childTo, childStartX, childEndX, centerY, {
          ...routeContext,
          parentType: 'series',
          directParallel: false,
        });
        childFrom = childTo;
      });
      return;
    }

    const childMetrics = node.children.map(measureTree);
    const branchGap = 2;
    const totalHeight = childMetrics.reduce((sum, item) => sum + item.height, 0)
      + branchGap * Math.max(0, node.children.length - 1);
    let cursor = centerY - totalHeight / 2;

    node.children.forEach((child, index) => {
      const branchY = cursor + childMetrics[index].height / 2;
      const childWidth = childMetrics[index].width;
      const childStartX = x0 + (x1 - x0 - childWidth) / 2;
      const childEndX = childStartX + childWidth;
      const diagonalBranch = (
        family === 'boxed-diagonal' && index === 0
      ) || (
        family === 'stacked-cells' && index % 2 === 0
      ) || (
        family === 'frame-crossbar' && index === node.children.length - 1
      ) || (
        family === 'bridge-fan' && index === 0
      );

      embed(child, from, to, childStartX, childEndX, branchY, {
        ...routeContext,
        parentType: 'parallel',
        branchY,
        directParallel: child.type === 'leaf',
        diagonalBranch,
        preference: index % 2 === 0 ? 'horizontal' : 'vertical',
      });
      cursor += childMetrics[index].height + branchGap;
    });
  }

  embed(tree, 'A', 'B', 0, width, 0, {
    parentType: null,
    branchY: 0,
    directParallel: false,
    preference: 'horizontal',
    diagonalBranch: false,
  });

  const maxY = Math.max(...nodes.map((node) => node.y), rootHeight / 2);
  const sourceY = maxY + 3;
  const sourceCenter = width / 2;
  const sourceRoute = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: sourceY },
    { x: sourceCenter - 0.8, y: sourceY },
    { x: sourceCenter + 0.8, y: sourceY },
    { x: width + 1, y: sourceY },
    { x: width + 1, y: 0 },
    { x: width, y: 0 },
  ];
  const equivalentRoute = [{ x: 0, y: 0 }, { x: width, y: 0 }];
  const sourceSymbol = { x: sourceCenter, y: sourceY, angle: 0 };
  const rawGraph = {
    nodes: nodes.map((node) => ({ ...node })),
    edges,
    sourceRoute,
    equivalentRoute,
    sourceSymbol,
  };
  const transformed = transformGraphLayout(rawGraph, layoutVariant);

  return {
    ...transformed,
    layout: {
      family,
      familyLabel: familyConfig.label,
      orientation: layoutVariant === 3 ? 'vertical' : 'horizontal',
      sourceRoute: transformed.sourceRoute,
      sourceSymbol: transformed.sourceSymbol,
      equivalentRoute: transformed.equivalentRoute,
      bounds: transformed.bounds,
    },
  };
}

function getSegments(route) {
  return (route || []).slice(1).map((point, index) => ({
    first: route[index],
    second: point,
  }));
}

const GEOMETRY_EPSILON = 0.000001;

function pointsMatch(first, second) {
  return Boolean(first && second)
    && Math.abs(first.x - second.x) <= GEOMETRY_EPSILON
    && Math.abs(first.y - second.y) <= GEOMETRY_EPSILON;
}

function segmentIntersection(first, second) {
  const ax = first.second.x - first.first.x;
  const ay = first.second.y - first.first.y;
  const bx = second.second.x - second.first.x;
  const by = second.second.y - second.first.y;
  const cross = ax * by - ay * bx;
  const cx = second.first.x - first.first.x;
  const cy = second.first.y - first.first.y;

  if (Math.abs(cross) <= GEOMETRY_EPSILON) {
    if (Math.abs(cx * ay - cy * ax) > GEOMETRY_EPSILON) return null;

    const useX = Math.abs(ax) >= Math.abs(ay);
    const firstStart = useX ? first.first.x : first.first.y;
    const firstEnd = useX ? first.second.x : first.second.y;
    const secondStart = useX ? second.first.x : second.first.y;
    const secondEnd = useX ? second.second.x : second.second.y;
    const overlapStart = Math.max(
      Math.min(firstStart, firstEnd),
      Math.min(secondStart, secondEnd),
    );
    const overlapEnd = Math.min(
      Math.max(firstStart, firstEnd),
      Math.max(secondStart, secondEnd),
    );

    if (overlapEnd < overlapStart - GEOMETRY_EPSILON) return null;
    if (overlapEnd > overlapStart + GEOMETRY_EPSILON) return { type: 'overlap' };

    const ratio = Math.abs(firstEnd - firstStart) <= GEOMETRY_EPSILON
      ? 0
      : (overlapStart - firstStart) / (firstEnd - firstStart);
    return {
      type: 'touch',
      point: {
        x: first.first.x + ax * ratio,
        y: first.first.y + ay * ratio,
      },
    };
  }

  const t = (cx * by - cy * bx) / cross;
  const u = (cx * ay - cy * ax) / cross;
  if (
    t < -GEOMETRY_EPSILON || t > 1 + GEOMETRY_EPSILON
    || u < -GEOMETRY_EPSILON || u > 1 + GEOMETRY_EPSILON
  ) return null;

  return {
    type: (
      t > GEOMETRY_EPSILON && t < 1 - GEOMETRY_EPSILON
      && u > GEOMETRY_EPSILON && u < 1 - GEOMETRY_EPSILON
    ) ? 'cross' : 'touch',
    point: {
      x: first.first.x + ax * t,
      y: first.first.y + ay * t,
    },
  };
}

function routeEndsAtEdgeNodes(edge, nodePositions) {
  const route = edge.route || [];
  if (route.length < 2) return false;
  const from = nodePositions.get(edge.from);
  const to = nodePositions.get(edge.to);
  const first = route[0];
  const last = route[route.length - 1];
  return (pointsMatch(first, from) && pointsMatch(last, to))
    || (pointsMatch(first, to) && pointsMatch(last, from));
}

function intersectionIsSharedNode(firstEdge, secondEdge, point, nodePositions) {
  if (!point) return false;
  const sharedNodeIds = [firstEdge.from, firstEdge.to]
    .filter((nodeId) => nodeId === secondEdge.from || nodeId === secondEdge.to);
  if (sharedNodeIds.length === 0) return false;

  const firstRoute = firstEdge.route || [];
  const secondRoute = secondEdge.route || [];
  const firstRouteEndpoints = [firstRoute[0], firstRoute[firstRoute.length - 1]];
  const secondRouteEndpoints = [secondRoute[0], secondRoute[secondRoute.length - 1]];

  return sharedNodeIds.some((nodeId) => {
    const node = nodePositions.get(nodeId);
    return pointsMatch(point, node)
      && firstRouteEndpoints.some((endpoint) => pointsMatch(endpoint, node))
      && secondRouteEndpoints.some((endpoint) => pointsMatch(endpoint, node));
  });
}

export function getGraphGeometryIssues(graph) {
  const issues = [];
  const nodePositions = new Map(graph.nodes.map((node) => [node.id, node]));
  const visibleRoutes = [...graph.edges];

  if (Array.isArray(graph.sourceRoute) && graph.sourceRoute.length >= 2) {
    visibleRoutes.push({
      id: '__source__',
      from: 'A',
      to: 'B',
      route: graph.sourceRoute,
    });
  }

  for (const edge of visibleRoutes) {
    if (!routeEndsAtEdgeNodes(edge, nodePositions)) {
      issues.push({ type: 'detached-route', edges: [edge.id] });
    }
  }

  for (let firstIndex = 0; firstIndex < visibleRoutes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < visibleRoutes.length; secondIndex += 1) {
      const firstEdge = visibleRoutes[firstIndex];
      const secondEdge = visibleRoutes[secondIndex];
      const firstSegments = getSegments(firstEdge.route);
      const secondSegments = getSegments(secondEdge.route);

      for (const firstSegment of firstSegments) {
        for (const secondSegment of secondSegments) {
          const intersection = segmentIntersection(firstSegment, secondSegment);
          if (!intersection) continue;

          const allowedNode = intersection.type === 'touch'
            && intersectionIsSharedNode(firstEdge, secondEdge, intersection.point, nodePositions);
          if (!allowedNode) {
            issues.push({
              type: intersection.type,
              edges: [firstEdge.id, secondEdge.id],
              point: intersection.point,
            });
          }
        }
      }
    }
  }

  return issues;
}

function graphSignature(graph, tree, family, layoutVariant) {
  const routeSignature = graph.edges
    .map((edge) => (
      edge.from + '-' + edge.to + ':' + edge.routeKind + ':'
      + (edge.route || []).map((point) => Math.round(point.x * 2) + ',' + Math.round(point.y * 2)).join(';')
    ))
    .sort()
    .join('|');
  return topologySignature(tree) + '|' + family + '|' + layoutVariant + '|' + routeSignature;
}

function graphGeometryIsValid(graph, difficulty) {
  const allPoints = collectGraphPoints(graph.nodes, graph.edges, graph.sourceRoute, graph.equivalentRoute);
  const bounds = getBounds(allPoints);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const aspect = Math.max(width / height, height / width);
  const aspectLimit = difficulty === 'challenge' ? 2.8 : 3.0;
  if (aspect > aspectLimit) return false;

  const diagonals = graph.edges.filter((edge) => edge.routeKind === 'diagonal');
  if (diagonals.length > 2) return false;

  if (graph.edges.some((edge) => getSegments(edge.route).some((segment) => (
    segment.first.x !== segment.second.x && segment.first.y !== segment.second.y
      ? edge.routeKind !== 'diagonal'
      : Math.hypot(
        segment.second.x - segment.first.x,
        segment.second.y - segment.first.y,
      ) < 0.55
  )))) return false;

  if (getGraphGeometryIssues(graph).length > 0) return false;

  const directParallelGroups = {};
  graph.edges.forEach((edge) => {
    const key = [edge.from, edge.to].sort().join('::');
    directParallelGroups[key] = (directParallelGroups[key] || 0) + 1;
  });
  return Object.values(directParallelGroups).every((count) => count <= 2);
}

function setSwitchValue(edge, compType, switchState) {
  edge.compType = 'S';
  edge.switchState = switchState;
  edge.label = 'S';
  edge.val = switchState === 'closed'
    ? (compType === 'R' ? 0 : Infinity)
    : (compType === 'R' ? Infinity : 0);
}

function attachOptionalSwitch(graph, compType, difficulty, random) {
  const chance = difficulty === 'challenge' ? 0.26 : difficulty === 'practice' ? 0.18 : 0.1;
  if (random() >= chance) return graph;

  const candidates = shuffle(
    graph.edges.filter((edge) => edge.compType === compType),
    random,
  );
  for (const candidate of candidates) {
    const switchState = random() > 0.48 ? 'open' : 'closed';
    const testEdges = graph.edges.map((edge) => ({ ...edge }));
    const testEdge = testEdges.find((edge) => edge.id === candidate.id);
    setSwitchValue(testEdge, compType, switchState);

    if (switchState === 'open') {
      const afterDelete = deleteGraphEdge(graph.nodes, testEdges, candidate.id);
      if (afterDelete.edges.length === 0) continue;
      if (afterDelete.edges.length > 1 && !isSolvable(afterDelete.nodes, afterDelete.edges)) continue;
    }

    setSwitchValue(candidate, compType, switchState);
    return graph;
  }

  return graph;
}

function createCanonicalFallback(compType, valueMode) {
  const value = valueMode === 'equal' ? 30 : 20;
  const nodes = [
    { id: 'A', x: 0, y: 0, terminal: 'A' },
    { id: 'B', x: 8, y: 0, terminal: 'B' },
    { id: 'N0', x: 2, y: -2 },
    { id: 'N1', x: 6, y: -2 },
    { id: 'N2', x: 2, y: 2 },
    { id: 'N3', x: 6, y: 2 },
  ];
  const makeEdge = (id, from, to, index, route) => {
    return {
      id,
      from,
      to,
      compType,
      val: value,
      label: compType + index,
      route,
      routeKind: 'orthogonal',
      routeStyle: getRouteStyle(route),
    };
  };
  const edges = [
    makeEdge('e0', 'A', 'N0', 1, [{ x: 0, y: 0 }, { x: 0, y: -2 }, { x: 2, y: -2 }]),
    makeEdge('e1', 'N0', 'N1', 2, [{ x: 2, y: -2 }, { x: 6, y: -2 }]),
    makeEdge('e2', 'N1', 'B', 3, [{ x: 6, y: -2 }, { x: 8, y: -2 }, { x: 8, y: 0 }]),
    makeEdge('e3', 'A', 'N2', 4, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }]),
    makeEdge('e4', 'N2', 'N3', 5, [{ x: 2, y: 2 }, { x: 6, y: 2 }]),
    makeEdge('e5', 'N3', 'B', 6, [{ x: 6, y: 2 }, { x: 6, y: 0 }, { x: 8, y: 0 }]),
  ];
  const sourceRoute = [
    { x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 5 },
    { x: 3.2, y: 5 }, { x: 4.8, y: 5 },
    { x: 9, y: 5 }, { x: 9, y: 0 }, { x: 8, y: 0 },
  ];
  const sourceSymbol = { x: 4, y: 5, angle: 0 };
  const normalized = normalizeGraphLayout(nodes, edges, sourceRoute, [{ x: 0, y: 0 }, { x: 8, y: 0 }], sourceSymbol);
  return {
    ...normalized,
    layout: {
      family: 'parallel-rails',
      familyLabel: ADVANCED_LAYOUT_FAMILIES['parallel-rails'].label,
      orientation: 'horizontal',
      sourceRoute: normalized.sourceRoute,
      sourceSymbol: normalized.sourceSymbol,
      equivalentRoute: normalized.equivalentRoute,
      bounds: normalized.bounds,
    },
  };
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
  const families = FAMILIES_BY_DIFFICULTY[difficulty] || FAMILIES_BY_DIFFICULTY.guided;
  let fallback = null;

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const attemptSeed = String(seed) + ':advanced:' + difficulty + ':' + attempt;
    const random = createSeededRandom(attemptSeed);
    const family = families[randomInt(random, 0, families.length - 1)];
    const targetLeaves = randomInt(random, config.minLeaves, config.maxLeaves);
    let topologyCounter = 0;
    const tree = buildTopology(
      { compType, config, family, random, valueMode: resolvedValueMode, nextId: () => 'g' + topologyCounter++ },
      targetLeaves,
    );
    const stats = getTreeStats(tree);
    if (stats.series === 0 || stats.parallel === 0) continue;

    const layoutVariant = family === 'stacked-cells' ? 3 : randomInt(random, 0, 3);
    let graph = createGraphFromTree(tree, compType, random, family, layoutVariant);
    graph = attachOptionalSwitch(graph, compType, difficulty, random);
    const signature = graphSignature(graph, tree, family, layoutVariant);
    const candidate = {
      ...graph,
      stats,
      seed: attemptSeed,
      config,
      family,
      signature,
      visualSignature: family + ':' + layoutVariant + ':' + graph.edges.map((edge) => edge.routeKind).join(','),
    };

    if (!isSolvable(candidate.nodes, candidate.edges)) continue;
    if (!graphGeometryIsValid(candidate, difficulty)) continue;
    fallback = candidate;
    if (!recentSignatures.includes(signature)) return candidate;
  }

  if (fallback) return fallback;

  const canonical = createCanonicalFallback(compType, resolvedValueMode);
  return {
    ...canonical,
    stats: { leaves: canonical.edges.length, depth: 3, series: 2, parallel: 1 },
    seed: String(seed) + ':advanced:fallback',
    config,
    family: 'parallel-rails',
    signature: 'fallback:' + compType + ':' + resolvedValueMode,
    visualSignature: 'parallel-rails:horizontal',
  };
}

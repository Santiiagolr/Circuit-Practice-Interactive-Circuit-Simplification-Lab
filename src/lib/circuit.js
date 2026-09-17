export const COMPONENT_VALUES = [10, 20, 30, 40, 50, 60];

export const DIFFICULTY_PRESETS = {
  guided: {
    label: 'Guiado',
    basic: {
      minLeaves: 4,
      maxLeaves: 6,
      maxDepth: 3,
      maxBranching: 2,
      parallelChance: 0.38,
      wireChance: 0.05,
    },
    advanced: {
      minLeaves: 6,
      maxLeaves: 8,
      maxDepth: 3,
      maxBranching: 2,
      parallelChance: 0.42,
      wireChance: 0.05,
    },
  },
  practice: {
    label: 'Práctica',
    basic: {
      minLeaves: 6,
      maxLeaves: 9,
      maxDepth: 4,
      maxBranching: 3,
      parallelChance: 0.48,
      wireChance: 0.08,
    },
    advanced: {
      minLeaves: 8,
      maxLeaves: 11,
      maxDepth: 4,
      maxBranching: 3,
      parallelChance: 0.5,
      wireChance: 0.08,
    },
  },
  challenge: {
    label: 'Desafío',
    basic: {
      minLeaves: 8,
      maxLeaves: 12,
      maxDepth: 5,
      maxBranching: 3,
      parallelChance: 0.54,
      wireChance: 0.1,
    },
    advanced: {
      minLeaves: 10,
      maxLeaves: 15,
      maxDepth: 5,
      maxBranching: 3,
      parallelChance: 0.56,
      wireChance: 0.1,
    },
  },
};

export function getDifficultyConfig(mode = 'basic', difficulty = 'guided') {
  return DIFFICULTY_PRESETS[difficulty]?.[mode] || DIFFICULTY_PRESETS.guided.basic;
}

export function generateId() {
  return 'id-' + Math.random().toString(36).slice(2, 11);
}

function hashSeed(seed) {
  const value = String(seed ?? Date.now());
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed = Date.now()) {
  let state = hashSeed(seed) || 1;

  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function createIdFactory(prefix = 'n') {
  let counter = 0;
  return () => prefix + counter++;
}

function splitBudget(total, parts, random) {
  const budgets = Array.from({ length: parts }, () => 1);
  let remaining = total - parts;

  while (remaining > 0) {
    budgets[randomInt(random, 0, parts - 1)] += 1;
    remaining -= 1;
  }

  return budgets.sort(() => random() - 0.5);
}

function chooseNodeType(random, parentType, config) {
  if (!parentType) {
    return random() < config.parallelChance ? 'parallel' : 'series';
  }

  // Alternating operators creates meaningful nested decisions. Equal
  // operators are flattened by cleanTree and do not add a useful step.
  const opposite = parentType === 'series' ? 'parallel' : 'series';
  if (random() < 0.78) return opposite;
  return random() < config.parallelChance ? 'parallel' : 'series';
}

function createLeaf(compType, random, config, nextId, valueMode = 'varied') {
  const isWire = random() < config.wireChance;
  const value = valueMode === 'equal'
    ? 30
    : COMPONENT_VALUES[randomInt(random, 0, COMPONENT_VALUES.length - 1)];

  return {
    type: 'leaf',
    id: nextId(),
    compType: isWire ? 'W' : compType,
    val: isWire
      ? compType === 'R' ? 0 : Infinity
      : value,
    label: isWire ? 'W' : compType,
  };
}

function buildTree({ compType, config, random, nextId, valueMode }, remaining, depth, parentType = null) {
  if (remaining <= 1 || depth >= config.maxDepth) {
    return createLeaf(compType, random, config, nextId, valueMode);
  }

  const maxChildren = Math.min(config.maxBranching, remaining);
  const childCount = maxChildren >= 3 && random() < 0.34 ? 3 : 2;
  const safeChildCount = Math.min(childCount, remaining);
  const type = chooseNodeType(random, parentType, config);
  const budgets = splitBudget(remaining, safeChildCount, random);

  return {
    type,
    id: nextId(),
    children: budgets.map((budget) => buildTree(
      { compType, config, random, nextId, valueMode },
      budget,
      depth + 1,
      type,
    )),
  };
}

export function calculateEquivalent(compType, vals, mode) {
  if (vals.length === 0) return 0;

  if (compType === 'R') {
    if (mode === 'series') {
      return vals.some((value) => value === Infinity)
        ? Infinity
        : vals.reduce((sum, value) => sum + value, 0);
    }

    if (vals.includes(0)) return 0;
    const finiteValues = vals.filter((value) => value !== Infinity);
    if (finiteValues.length === 0) return Infinity;
    return 1 / finiteValues.reduce((sum, value) => sum + (1 / value), 0);
  }

  if (compType === 'C') {
    if (mode === 'parallel') {
      return vals.includes(Infinity)
        ? Infinity
        : vals.reduce((sum, value) => sum + value, 0);
    }

    if (vals.includes(0)) return 0;
    const finiteValues = vals.filter((value) => value !== Infinity);
    if (finiteValues.length === 0) return Infinity;
    return 1 / finiteValues.reduce((sum, value) => sum + (1 / value), 0);
  }

  return 0;
}

export function formatValue(val, compType) {
  if (compType === 'W') return 'Cable';
  if (val === 0) return compType === 'R' ? '0 Ω · cable' : '0 F';
  if (val === Infinity) return compType === 'C' ? '∞ F · cable' : '∞ Ω · abierto';
  if (val < 0.01) return val.toExponential(2) + ' ' + (compType === 'R' ? 'Ω' : 'F');
  return Number(val.toFixed(2)) + ' ' + (compType === 'R' ? 'Ω' : 'F');
}

export function findCommonParent(tree, ids) {
  const selectedIds = new Set(ids);
  let foundParent = null;
  let invalid = false;

  function traverse(node, parent) {
    if (node.type === 'leaf') {
      if (!selectedIds.has(node.id)) return;
      if (!foundParent) {
        foundParent = parent;
      } else if (foundParent.id !== parent?.id) {
        invalid = true;
      }
      return;
    }

    node.children.forEach((child) => traverse(child, node));
  }

  traverse(tree, null);
  return invalid ? null : foundParent;
}

export function validateSelection(tree, ids, action) {
  if (ids.length < 2) {
    return { valid: false, message: 'Selecciona al menos 2 componentes.' };
  }

  const parent = findCommonParent(tree, ids);
  if (!parent) {
    return {
      valid: false,
      message: 'Los componentes seleccionados no están en el mismo bloque. Resuelve los subcircuitos internos primero.',
    };
  }

  const indices = ids
    .map((id) => parent.children.findIndex((child) => child.id === id))
    .sort((a, b) => a - b);

  if (indices.some((index) => index < 0)) {
    return { valid: false, message: 'La selección ya no pertenece al circuito actual.' };
  }

  if (action === 'series') {
    if (parent.type !== 'series') {
      return { valid: false, message: 'Estos componentes están en paralelo, no en serie.' };
    }

    for (let index = 0; index < indices.length - 1; index += 1) {
      if (indices[index + 1] - indices[index] !== 1) {
        return {
          valid: false,
          message: 'Para combinarlos en serie, deben estar adyacentes sin una rama en medio.',
        };
      }
    }
  } else if (action === 'parallel') {
    if (parent.type !== 'parallel') {
      return { valid: false, message: 'Estos componentes están en serie, no en paralelo.' };
    }
  } else {
    return { valid: false, message: 'Acción no reconocida.' };
  }

  return { valid: true, parent };
}

export function cleanTree(node) {
  if (node.type === 'leaf') return node;

  const children = node.children.map(cleanTree);
  const flattened = [];

  children.forEach((child) => {
    if (child.type === node.type) {
      flattened.push(...child.children);
    } else {
      flattened.push(child);
    }
  });

  if (flattened.length === 1) return flattened[0];
  return { ...node, children: flattened };
}

export function combineNodes(tree, ids, action, compType) {
  const { valid, parent } = validateSelection(tree, ids, action);
  if (!valid) return tree;

  const selectedIds = new Set(ids);
  const newTree = JSON.parse(JSON.stringify(tree));

  function process(node) {
    if (node.id === parent.id) {
      const selectedNodes = node.children.filter((child) => selectedIds.has(child.id));
      const combinedVal = calculateEquivalent(
        compType,
        selectedNodes.map((child) => child.val),
        action,
      );
      const isWire = (compType === 'R' && combinedVal === 0)
        || (compType === 'C' && combinedVal === Infinity);
      const newNode = {
        type: 'leaf',
        id: generateId(),
        compType: isWire ? 'W' : compType,
        val: combinedVal,
        label: isWire ? 'W' : 'Eq',
      };

      if (action === 'series') {
        const firstIndex = node.children.findIndex((child) => selectedIds.has(child.id));
        node.children.splice(firstIndex, selectedNodes.length, newNode);
      } else {
        node.children = [
          ...node.children.filter((child) => !selectedIds.has(child.id)),
          newNode,
        ];
      }
      return;
    }

    node.children?.forEach(process);
  }

  process(newTree);
  return cleanTree(newTree);
}

export function relabelTree(node, compType, counter = { val: 1 }) {
  if (node.type === 'leaf') {
    if (node.compType === 'W' || node.compType === 'S') {
      node.label = node.compType;
    } else {
      node.label = compType + counter.val;
      counter.val += 1;
    }
    return node;
  }

  node.children.forEach((child) => relabelTree(child, compType, counter));
  return node;
}

export function topologySignature(node) {
  if (node.type === 'leaf') {
    if (node.compType === 'W') return 'W';
    if (node.compType === 'S') return 'S';
    return 'X';
  }

  const children = node.children.map(topologySignature);
  if (node.type === 'parallel') children.sort();

  const forward = children.join(',');
  const reverse = [...children].reverse().join(',');
  const canonicalChildren = node.type === 'series' && reverse < forward ? reverse : forward;
  return (node.type === 'series' ? 'S' : 'P') + '(' + canonicalChildren + ')';
}

export function getTreeStats(node) {
  if (node.type === 'leaf') return { leaves: 1, depth: 1, series: 0, parallel: 0, maxBranching: 1 };

  const childStats = node.children.map(getTreeStats);
  return {
    leaves: childStats.reduce((sum, stats) => sum + stats.leaves, 0),
    depth: 1 + Math.max(...childStats.map((stats) => stats.depth)),
    series: (node.type === 'series' ? 1 : 0) + childStats.reduce((sum, stats) => sum + stats.series, 0),
    parallel: (node.type === 'parallel' ? 1 : 0) + childStats.reduce((sum, stats) => sum + stats.parallel, 0),
    maxBranching: Math.max(node.children.length, ...childStats.map((stats) => stats.maxBranching)),
  };
}

function hasSimpleTwoLaneLoop(node) {
  if (node.type === 'leaf') return false;

  const isTwoLeafSeries = (child) => (
    child.type === 'series'
    && child.children.length === 2
    && child.children.every((grandchild) => grandchild.type === 'leaf')
  );

  if (
    node.type === 'parallel'
    && node.children.length === 2
    && node.children.every(isTwoLeafSeries)
  ) {
    return true;
  }

  return node.children.some(hasSimpleTwoLaneLoop);
}

function isTooObvious(tree) {
  if (tree.type === 'leaf') return true;
  if (tree.type === 'parallel' && tree.children.every((child) => child.type === 'leaf')) return true;
  return hasSimpleTwoLaneLoop(tree);
}

function buildExercise(compType, options = {}) {
  const {
    mode = 'basic',
    difficulty = 'guided',
    seed = Date.now(),
    valueMode = 'varied',
    recentSignatures = [],
  } = options;
  const config = getDifficultyConfig(mode, difficulty);
  let fallback = null;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const attemptSeed = String(seed) + ':' + mode + ':' + difficulty + ':' + attempt;
    const random = createSeededRandom(attemptSeed);
    const nextId = createIdFactory(mode === 'basic' ? 'b' : 'g');
    const leafCount = randomInt(random, config.minLeaves, config.maxLeaves);
    const tree = cleanTree(buildTree(
      { compType, config, random, nextId, valueMode },
      leafCount,
      0,
    ));
    const signature = topologySignature(tree);
    const stats = getTreeStats(tree);

    fallback = { tree, signature, stats, seed: attemptSeed };
    const hasBothOperators = stats.series > 0 && stats.parallel > 0;
    const isNew = !recentSignatures.includes(signature);
    const isUseful = !isTooObvious(tree) && (stats.leaves < 5 || hasBothOperators);

    if (isNew && isUseful) return fallback;
  }

  return fallback;
}

export function generateStructuredExercise(compType, options = {}) {
  const exercise = buildExercise(compType, options);
  const tree = relabelTree(exercise.tree, compType);
  return { ...exercise, tree, signature: topologySignature(tree) };
}

export function generateBasicExercise(compType, options = {}) {
  return generateStructuredExercise(compType, { ...options, mode: 'basic' });
}

// Backwards-compatible entry point for callers that still provide depth values.
export function generateRandomCircuit(compType, depthOrOptions = {}, maxDepth = 2) {
  if (typeof depthOrOptions === 'number') {
    const config = {
      ...getDifficultyConfig('basic', 'guided'),
      maxDepth,
      minLeaves: 2,
      maxLeaves: Math.max(2, maxDepth + 2),
    };
    const random = createSeededRandom(Date.now());
    const nextId = createIdFactory('b');
    return cleanTree(buildTree(
      { compType, config, random, nextId, valueMode: 'varied' },
      randomInt(random, config.minLeaves, config.maxLeaves),
      depthOrOptions,
    ));
  }

  return generateBasicExercise(compType, depthOrOptions).tree;
}

export const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Node types:
 * - leaf: { type: 'leaf', id, compType: 'R'|'C', val, label }
 * - series: { type: 'series', id, children: [Node, Node...] }
 * - parallel: { type: 'parallel', id, children: [Node, Node...] }
 */

export function calculateEquivalent(compType, vals, mode) {
  if (vals.length === 0) return 0;
  if (compType === 'R') {
    if (mode === 'series') {
      return vals.reduce((a, b) => a + b, 0);
    } else { // parallel
      if (vals.includes(0)) return 0; // Short circuit
      const sumInv = vals.reduce((a, b) => a + (1 / b), 0);
      return sumInv === 0 ? 0 : 1 / sumInv;
    }
  } else if (compType === 'C') {
    if (mode === 'parallel') {
      if (vals.includes(Infinity)) return Infinity;
      return vals.reduce((a, b) => a + b, 0);
    } else { // series
      if (vals.includes(0)) return 0; // Should not happen with ideal wires, but safe
      const sumInv = vals.reduce((a, b) => a + (1 / b), 0);
      return sumInv === 0 ? 0 : 1 / sumInv;
    }
  }
  return 0;
}

export function formatValue(val, compType) {
  if (val === 0) return '0Ω (Cable)';
  if (val === Infinity) return 'Corto (Cable)';
  if (val < 0.01) return val.toExponential(2) + (compType === 'R' ? 'Ω' : 'F');
  return Number(val.toFixed(2)) + (compType === 'R' ? 'Ω' : 'F');
}

export function findCommonParent(tree, ids) {
  let foundParent = null;

  function traverse(node, parent) {
    if (ids.includes(node.id)) {
      if (!foundParent) {
        foundParent = parent;
      } else if (foundParent.id !== parent.id) {
        foundParent = 'INVALID';
      }
    }
    if (node.children) {
      node.children.forEach(child => traverse(child, node));
    }
  }
  
  traverse(tree, null);
  return foundParent === 'INVALID' ? null : foundParent;
}

export function validateSelection(tree, ids, action) {
  if (ids.length < 2) return { valid: false, message: 'Selecciona al menos 2 componentes.' };

  const parent = findCommonParent(tree, ids);
  if (!parent) return { valid: false, message: 'Los componentes seleccionados no están directamente conectados en el mismo bloque. Resuelve los subcircuitos internos primero.' };

  if (action === 'series') {
    if (parent.type !== 'series') return { valid: false, message: 'Estos componentes están en paralelo, no en serie.' };
    
    const indices = ids.map(id => parent.children.findIndex(c => c.id === id)).sort((a, b) => a - b);
    for (let i = 0; i < indices.length - 1; i++) {
      if (indices[i + 1] - indices[i] !== 1) {
        return { valid: false, message: 'Para combinarlos en serie, deben estar adyacentes sin ramificaciones en medio.' };
      }
    }
  } else if (action === 'parallel') {
    if (parent.type !== 'parallel') return { valid: false, message: 'Estos componentes están en serie, no en paralelo.' };
  }

  return { valid: true, parent };
}

export function cleanTree(node) {
  if (node.type === 'leaf') return node;
  
  node.children = node.children.map(cleanTree);
  
  if (node.children.length === 1) {
    return node.children[0];
  }
  
  const newChildren = [];
  for (const child of node.children) {
    if (child.type === node.type) {
      newChildren.push(...child.children);
    } else {
      newChildren.push(child);
    }
  }
  node.children = newChildren;
  
  return node;
}

export function combineNodes(tree, ids, action, compType) {
  const { valid, parent } = validateSelection(tree, ids, action);
  if (!valid) return tree;

  const newTree = JSON.parse(JSON.stringify(tree));
  
  function process(node) {
    if (node.id === parent.id) {
      const selectedNodes = node.children.filter(c => ids.includes(c.id));
      const unselectedNodes = node.children.filter(c => !ids.includes(c.id));
      
      const combinedVal = calculateEquivalent(
        compType, 
        selectedNodes.map(n => n.val), 
        action
      );
      
      const newNode = {
        type: 'leaf',
        id: generateId(),
        compType,
        val: combinedVal,
        label: 'Eq'
      };

      if (action === 'series') {
        const firstIdx = node.children.findIndex(c => ids.includes(c.id));
        node.children.splice(firstIdx, ids.length, newNode);
      } else {
        node.children = [...unselectedNodes, newNode];
      }
    } else if (node.children) {
      node.children.forEach(process);
    }
  }

  process(newTree);
  return cleanTree(newTree);
}

export function generateRandomCircuit(compType, depth = 0, maxDepth = 2) {
  // Never generate a single leaf at the very root, so we always have at least 1 operation to perform.
  if (depth >= maxDepth || (depth > 0 && Math.random() < 0.3)) {
    const isWire = Math.random() < 0.2; // 20% chance to be a pure wire
    let val;
    if (isWire) {
      val = compType === 'R' ? 0 : Infinity;
    } else {
      val = [10, 20, 30, 40, 50, 60][Math.floor(Math.random() * 6)];
    }
    return {
      type: 'leaf',
      id: generateId(),
      compType: isWire ? 'W' : compType,
      val,
      label: isWire ? 'W' : compType // will be overwritten by relabelTree if not W
    };
  }

  const type = Math.random() > 0.5 ? 'series' : 'parallel';
  const numChildren = Math.floor(Math.random() * 2) + 2;
  const children = [];
  for (let i = 0; i < numChildren; i++) {
    children.push(generateRandomCircuit(compType, depth + 1, maxDepth));
  }

  return cleanTree({
    type,
    id: generateId(),
    children
  });
}

export function relabelTree(node, compType, counter = { val: 1 }) {
  if (node.type === 'leaf') {
    if (node.compType === 'W') {
      node.label = 'W';
    } else {
      node.label = compType + counter.val;
      counter.val++;
    }
    return node;
  }
  if (node.children) {
    node.children.forEach(child => relabelTree(child, compType, counter));
  }
  return node;
}

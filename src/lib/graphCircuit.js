export const generateId = () => Math.random().toString(36).substr(2, 9);

// ── Equivalent calculations ───────────────────────────────────────────
export function calcEq(compType, vals, mode) {
  if (compType === 'R') {
    if (mode === 'series') return vals.reduce((a, b) => a + b, 0);
    else {
      if (vals.includes(0)) return 0;
      return 1 / vals.reduce((a, b) => a + 1 / b, 0);
    }
  } else {
    if (mode === 'parallel') {
      if (vals.includes(Infinity)) return Infinity;
      return vals.reduce((a, b) => a + b, 0);
    }
    else {
      if (vals.includes(0)) return 0;
      return 1 / vals.reduce((a, b) => a + 1 / b, 0);
    }
  }
}

export function formatValue(val, compType) {
  if (val === 0) return '0Ω (Cable)';
  if (val === Infinity) return 'Corto (Cable)';
  if (val < 0.01) return val.toExponential(2) + (compType === 'R' ? 'Ω' : 'F');
  return Number(val.toFixed(2)) + (compType === 'R' ? 'Ω' : 'F');
}

// ── Graph helpers ─────────────────────────────────────────────────────
function edgesMatch(e1, e2) {
  return (e1.from === e2.from && e1.to === e2.to) ||
    (e1.from === e2.to && e1.to === e2.from);
}

function getNodeEdges(edges, nodeId) {
  return edges.filter(e => e.from === nodeId || e.to === nodeId);
}

function otherEnd(edge, nodeId) {
  return edge.from === nodeId ? edge.to : edge.from;
}

// ── Solvability check ─────────────────────────────────────────────────
export function isSolvable(nodesIn, edgesIn) {
  let nodes = nodesIn.map(n => ({ ...n }));
  let edges = edgesIn.map(e => ({ ...e }));

  let changed = true;
  while (changed && edges.length > 1) {
    changed = false;

    // Parallel: two edges between the same pair of nodes
    for (let i = 0; i < edges.length && !changed; i++) {
      for (let j = i + 1; j < edges.length && !changed; j++) {
        if (edgesMatch(edges[i], edges[j])) {
          edges.splice(j, 1);
          changed = true;
        }
      }
    }
    if (changed) continue;

    // Series: non-terminal node with degree 2
    for (const node of nodes) {
      if (node.terminal) continue;
      const ne = getNodeEdges(edges, node.id);
      if (ne.length === 2) {
        const [e1, e2] = ne;
        const end1 = otherEnd(e1, node.id);
        const end2 = otherEnd(e2, node.id);
        e1.from = end1;
        e1.to = end2;
        edges = edges.filter(e => e.id !== e2.id);
        nodes = nodes.filter(n => n.id !== node.id);
        changed = true;
        break;
      }
    }

    // Remove degree-0 non-terminal nodes
    nodes = nodes.filter(n => n.terminal || getNodeEdges(edges, n.id).length > 0);
  }

  return edges.length === 1;
}

// ── Validate selection ────────────────────────────────────────────────
export function validateGraphSelection(nodes, edges, selectedIds, action) {
  if (selectedIds.length < 2) return { valid: false, message: 'Seleccioná al menos 2 componentes.' };

  const selected = edges.filter(e => selectedIds.includes(e.id));
  if (selected.length !== selectedIds.length) return { valid: false, message: 'Selección inválida.' };

  if (action === 'parallel') {
    const ref = selected[0];
    const pair = [ref.from, ref.to].sort();
    for (const e of selected) {
      const p = [e.from, e.to].sort();
      if (p[0] !== pair[0] || p[1] !== pair[1]) {
        return { valid: false, message: 'Para paralelo, todos los componentes deben conectar exactamente los mismos dos nodos.' };
      }
    }
    return { valid: true };
  }

  if (action === 'series') {
    if (selected.length !== 2) return { valid: false, message: 'Para serie, seleccioná exactamente 2 componentes.' };
    const [e1, e2] = selected;
    let shared = null;
    for (const n of [e1.from, e1.to]) {
      if (n === e2.from || n === e2.to) { shared = n; break; }
    }
    if (!shared) return { valid: false, message: 'Los componentes no comparten un nodo en común.' };

    const node = nodes.find(n => n.id === shared);
    if (node?.terminal) return { valid: false, message: 'El nodo compartido es un terminal (A o B). No se pueden combinar en serie a través de un terminal.' };

    const degree = getNodeEdges(edges, shared).length;
    if (degree !== 2) return { valid: false, message: `El nodo compartido tiene ${degree} conexiones. Para serie, debe tener exactamente 2.` };

    return { valid: true, sharedNode: shared };
  }

  return { valid: false, message: 'Acción no reconocida.' };
}

// ── Combine edges ─────────────────────────────────────────────────────
export function combineGraphEdges(nodes, edges, selectedIds, action, compType) {
  let newNodes = nodes.map(n => ({ ...n }));
  let newEdges = edges.map(e => ({ ...e }));
  const selected = newEdges.filter(e => selectedIds.includes(e.id));

  if (action === 'parallel') {
    const eqVal = calcEq(compType, selected.map(e => e.val), 'parallel');
    const isWire = (compType === 'R' && eqVal === 0) || (compType === 'C' && eqVal === Infinity);
    const kept = selected[0];
    kept.val = eqVal;
    kept.compType = isWire ? 'W' : compType;
    kept.label = isWire ? 'W' : 'Eq';
    kept.id = generateId();
    const removeIds = selected.slice(1).map(e => e.id);
    newEdges = newEdges.filter(e => !removeIds.includes(e.id));
  } else if (action === 'series') {
    const [e1, e2] = selected;
    let shared = null;
    for (const n of [e1.from, e1.to]) {
      if (n === e2.from || n === e2.to) { shared = n; break; }
    }
    const end1 = otherEnd(e1, shared);
    const end2 = otherEnd(e2, shared);
    const eqVal = calcEq(compType, [e1.val, e2.val], 'series');
    const isWire = (compType === 'R' && eqVal === 0) || (compType === 'C' && eqVal === Infinity);
    e1.from = end1;
    e1.to = end2;
    e1.val = eqVal;
    e1.compType = isWire ? 'W' : compType;
    e1.label = isWire ? 'W' : 'Eq';
    e1.id = generateId();
    newEdges = newEdges.filter(e => e.id !== e2.id);
    newNodes = newNodes.filter(n => n.id !== shared);
  }

  return { nodes: newNodes, edges: newEdges };
}

export function deleteGraphEdge(nodes, edges, edgeId) {
  let newNodes = nodes.map(n => ({ ...n }));
  let newEdges = edges.filter(e => e.id !== edgeId);

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of newNodes) {
      if (node.terminal) continue;
      const connectedEdges = newEdges.filter(e => e.from === node.id || e.to === node.id);
      if (connectedEdges.length === 1) {
        // Dangling branch! Remove the edge and the node
        newEdges = newEdges.filter(e => e.id !== connectedEdges[0].id);
        newNodes = newNodes.filter(n => n.id !== node.id);
        changed = true;
        break;
      } else if (connectedEdges.length === 0) {
        newNodes = newNodes.filter(n => n.id !== node.id);
        changed = true;
        break;
      }
    }
  }

  return { nodes: newNodes, edges: newEdges };
}

// ── Circuit generation ────────────────────────────────────────────────
const TEMPLATES = [
  // 1. The user's bridge-like image (Series-Parallel with diagonals)
  {
    nodes: [
      { id: 'A', x: 0, y: 0, terminal: 'A' },
      { id: 'B', x: 0, y: 2, terminal: 'B' },
      { id: 'C', x: 1, y: 0 },
      { id: 'D', x: 1, y: 1 },
      { id: 'E', x: 1, y: 2 }
    ],
    edges: [['A', 'C'], ['A', 'D'], ['C', 'D'], ['B', 'E'], ['B', 'D'], ['E', 'D']]
  },
  // 2. Diamond with parallel edges
  {
    nodes: [
      { id: 'A', x: 0, y: 1, terminal: 'A' },
      { id: 'B', x: 2, y: 1, terminal: 'B' },
      { id: 'C', x: 1, y: 0 },
      { id: 'D', x: 1, y: 2 }
    ],
    edges: [['A', 'C'], ['C', 'B'], ['A', 'D'], ['A', 'D'], ['D', 'B']]
  },
  // 3. Puente con Corto (Imagen 1 revisada)
  {
    nodes: [
      { id: 'A', x: 0, y: 0, terminal: 'A' },
      { id: 'B', x: 0, y: 2, terminal: 'B' },
      { id: 'N_mid', x: 1, y: 1 },
      { id: 'N_TR', x: 2, y: 0 },
      { id: 'N_BR', x: 2, y: 2 }
    ],
    edges: [
      ['A', 'N_mid'], // Diagonal R
      ['A', 'N_mid'], // Top-left vertical R (Parallel to diagonal visually/topologically)
      ['A', 'N_TR'], // Top horizontal
      ['N_TR', 'N_mid'], // Top-right vertical
      ['N_mid', 'B'], // Bottom-left vertical
      ['N_mid', 'N_BR'], // Bottom-right vertical
      ['B', 'N_BR'] // Bottom horizontal
    ]
  },
  // 4. Doble Lazo Diagonal (Imagen 2 revisada)
  {
    nodes: [
      { id: 'A', x: 0, y: 0, terminal: 'A' },
      { id: 'B', x: 0, y: 2, terminal: 'B' },
      { id: 'N1', x: 1, y: 0 },
      { id: 'N2', x: 1, y: 2 },
      { id: 'N3', x: 2, y: 0 }
    ],
    edges: [
      ['A', 'N1'], // Input A
      ['B', 'N2'], // Input B
      ['N1', 'N3'], // Top horizontal
      ['N1', 'N2'], // Vertical 
      ['N2', 'N3'], // Diagonal
      ['N2', 'N3'] // Right vertical (parallel to diagonal)
    ]
  },
  // 5. Malla con Interruptor (Imagen 4 revisada)
  {
    nodes: [
      { id: 'A', x: 1, y: 0, terminal: 'A' },
      { id: 'B', x: 1, y: 2, terminal: 'B' },
      { id: 'N_ML', x: 1, y: 1 },
      { id: 'N_MR', x: 2, y: 1 },
      { id: 'N_TR', x: 2, y: 0 },
      { id: 'N_BR', x: 2, y: 2 }
    ],
    edges: [
      ['A', 'N_ML', 'C'], // C1
      ['A', 'N_TR', 'C'], // C2 top connection
      ['N_TR', 'N_MR', 'C'], // C2 
      ['N_ML', 'N_MR', 'C'], // C3 (middle)
      ['N_MR', 'N_BR', 'C'], // C4
      ['N_BR', 'B', 'W'], // B bottom connection
      ['N_ML', 'B', 'S'] // Switch
    ]
  },
  // 6. Puente con Fuente Central (Imagen 5 revisada)
  {
    nodes: [
      { id: 'A', x: 1, y: 0, terminal: 'A' }, // Using A/B as the battery terminals
      { id: 'B', x: 1, y: 2, terminal: 'B' },
      { id: 'N_TL', x: 0, y: 0 },
      { id: 'N_TR', x: 2, y: 0 },
      { id: 'N_BL', x: 0, y: 2 },
      { id: 'N_BR', x: 2, y: 2 }
    ],
    edges: [
      ['A', 'N_TL', 'W'], // Top wire
      ['A', 'N_TR', 'W'], // Top wire right
      ['B', 'N_BL', 'W'], // Bottom wire
      ['B', 'N_BR', 'W'], // Bottom wire right
      ['N_TL', 'N_BL', 'R'], // Far left vertical
      ['N_TL', 'B', 'R'], // Diagonal left
      ['A', 'N_TR', 'R'], // Top right horizontal
      ['B', 'N_TR', 'R'], // Diagonal right
      ['B', 'N_BR', 'R']  // Bottom right horizontal
    ]
  }
];

export function generateGridCircuit(compType, valueMode = 'varied') {
  const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  
  // Random reflections for variety
  const flipX = Math.random() > 0.5;
  const flipY = Math.random() > 0.5;
  
  // Find max bounds for flipping
  let maxX = 0, maxY = 0;
  tpl.nodes.forEach(n => {
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  });

  const nodes = tpl.nodes.map(n => ({
    id: n.id,
    x: flipX ? maxX - n.x : n.x,
    y: flipY ? maxY - n.y : n.y,
    terminal: n.terminal
  }));

  const possibleValues = [10, 20, 30, 40, 50];
  const fixedValue = possibleValues[Math.floor(Math.random() * possibleValues.length)];

  const edges = tpl.edges.map((e, i) => {
    // Some templates force a specific type (e.g. Switch 'S', Wire 'W', or 'C' / 'R')
    const forcedType = e[2];
    
    let isWire = false;
    let isSwitch = false;
    let switchState = 'closed';
    let edgeCompType = compType;

    if (forcedType === 'W') {
      isWire = true;
      edgeCompType = 'W';
    } else if (forcedType === 'S') {
      isSwitch = true;
      edgeCompType = 'S';
      switchState = Math.random() > 0.5 ? 'open' : 'closed';
    } else if (forcedType) {
      // Templates may annotate a physical component for their reference drawing,
      // but the selected practice mode owns the component family. This keeps the
      // symbol, unit and formula panel aligned in Capacitor mode as well.
      edgeCompType = compType;
    } else {
      isWire = Math.random() < 0.2; // 20% chance to be a pure wire for normal edges
      if (isWire) edgeCompType = 'W';
    }

    let val;
    if (isWire) {
      val = compType === 'R' ? 0 : Infinity;
    } else if (isSwitch) {
      val = switchState === 'closed' ? (compType === 'R' ? 0 : Infinity) : (compType === 'R' ? Infinity : 0);
    } else {
      val = valueMode === 'equal' 
        ? fixedValue 
        : possibleValues[Math.floor(Math.random() * possibleValues.length)];
    }
      
    let label = compType + (i + 1);
    if (isWire) label = 'W';
    if (isSwitch) label = 'S';

    return {
      id: generateId(),
      from: e[0],
      to: e[1],
      compType: edgeCompType,
      switchState,
      val,
      label,
    };
  });

  return { nodes, edges };
}

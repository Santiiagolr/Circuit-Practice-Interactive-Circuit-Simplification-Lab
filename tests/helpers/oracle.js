export function oracleCombine(compType, values, mode) {
  if (values.length === 0) return 0;
  const additive = (compType === 'R' && mode === 'series')
    || (compType === 'C' && mode === 'parallel');
  if (additive) {
    return values.includes(Infinity) ? Infinity : values.reduce((sum, value) => sum + value, 0);
  }
  if (values.includes(0)) return 0;
  const finite = values.filter((value) => value !== Infinity);
  if (finite.length === 0) return Infinity;
  return 1 / finite.reduce((sum, value) => sum + 1 / value, 0);
}

export function evaluateTree(node, compType) {
  if (node.type === 'leaf') return node.val;
  return oracleCombine(compType, node.children.map((child) => evaluateTree(child, compType)), node.type);
}

function unionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor);
      parent.set(cursor, current);
      cursor = next;
    }
    return current;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };
  return { find, union };
}

function solveLinear(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => row.concat(vector[index]));
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let item = column; item <= size; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= size; item += 1) {
        augmented[row][item] -= factor * augmented[column][item];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

export function evaluateGraphNetwork(nodes, edges, compType) {
  const ids = nodes.map((node) => node.id);
  const uf = unionFind(ids);
  const isShort = (edge) => compType === 'R' ? edge.val === 0 : edge.val === Infinity;
  const isOpen = (edge) => compType === 'R' ? edge.val === Infinity : edge.val === 0;
  edges.filter(isShort).forEach((edge) => uf.union(edge.from, edge.to));
  const source = uf.find('A');
  const sink = uf.find('B');
  if (source === sink) return compType === 'R' ? 0 : Infinity;

  const reducedEdges = edges.filter((edge) => !isShort(edge) && !isOpen(edge)).map((edge) => ({
    from: uf.find(edge.from),
    to: uf.find(edge.to),
    conductance: compType === 'R' ? 1 / edge.val : edge.val,
  })).filter((edge) => edge.from !== edge.to);
  const internal = [...new Set(ids.map(uf.find))].filter((id) => id !== source && id !== sink);
  const indexById = new Map(internal.map((id, index) => [id, index]));
  const matrix = internal.map(() => internal.map(() => 0));
  const vector = internal.map(() => 0);

  for (const edge of reducedEdges) {
    for (const [nodeId, otherId] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      const row = indexById.get(nodeId);
      if (row === undefined) continue;
      matrix[row][row] += edge.conductance;
      if (otherId === source) vector[row] += edge.conductance;
      else if (otherId !== sink) matrix[row][indexById.get(otherId)] -= edge.conductance;
    }
  }
  const voltages = solveLinear(matrix, vector) || [];
  let current = 0;
  for (const edge of reducedEdges) {
    if (edge.from !== source && edge.to !== source) continue;
    const other = edge.from === source ? edge.to : edge.from;
    const voltage = other === sink ? 0 : voltages[indexById.get(other)];
    current += edge.conductance * (1 - voltage);
  }
  if (current <= 1e-12) return compType === 'R' ? Infinity : 0;
  return compType === 'R' ? 1 / current : current;
}

export function expectClose(actual, expected, tolerance = 1e-7) {
  if (actual === expected) return true;
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));
}

// Electrical connectivity never depends on screen coordinates or component values.
export function astToNetwork(tree) {
  const nodes = [{ id: 'A', terminal: true }, { id: 'B', terminal: true }];
  const edges = [];
  let counter = 0;
  function visit(node, from, to) {
    if (node.type === 'leaf') { edges.push({ ...node, from, to }); return; }
    if (node.type === 'parallel') { node.children.forEach(child => visit(child, from, to)); return; }
    let start = from;
    node.children.forEach((child, i) => {
      const end = i === node.children.length - 1 ? to : `junction-${counter++}`;
      if (end !== to) nodes.push({ id: end });
      visit(child, start, end);
      start = end;
    });
  }
  visit(tree, 'A', 'B');
  return { nodes, edges };
}

export function validateTopology(nodes, edges, ids, rule) {
  const invalid = (message, kind = 'answer') => ({ valid: false, message, kind });
  if (!['series', 'parallel'].includes(rule)) return invalid('Acción no reconocida.', 'interface');
  if (ids.length < 2 || new Set(ids).size !== ids.length) return invalid('Seleccioná al menos dos componentes distintos.', 'interface');
  const map = new Map(edges.map(edge => [edge.id, edge]));
  const selected = ids.map(id => map.get(id));
  if (selected.some(edge => !edge)) return invalid('La selección cambió. Volvé a seleccionar los componentes.', 'interface');
  if (selected.some(edge => edge.compType === 'S' && edge.switchState === 'open')) return invalid('Eliminá primero el interruptor abierto; esa rama no conduce.');
  if (rule === 'parallel') {
    const first = selected[0];
    return selected.every(edge => edge.from !== edge.to && ((edge.from === first.from && edge.to === first.to) || (edge.from === first.to && edge.to === first.from)))
      ? { valid: true, orderedEdges: selected, pathNodes: [first.from, first.to] }
      : invalid('En paralelo, todos los componentes deben conectar los mismos dos nodos.');
  }
  const incident = new Map();
  for (const edge of selected) for (const id of [edge.from, edge.to]) incident.set(id, [...(incident.get(id) || []), edge]);
  const ends = [];
  for (const [id, attached] of incident) {
    if (attached.length === 1) { ends.push(id); continue; }
    if (attached.length !== 2) return invalid('La selección se bifurca: una serie debe ser una única cadena.');
    if (nodes.find(node => node.id === id)?.terminal) return invalid('La cadena atraviesa un terminal de la batería.');
    const degree = edges.filter(edge => edge.from === id || edge.to === id).length;
    if (degree !== 2) return invalid(`El nodo intermedio tiene ${degree} conexiones: hay una derivación, no una serie.`);
  }
  if (ends.length !== 2) return invalid('La selección debe formar una cadena continua, no un lazo cerrado.');
  const visited = new Set();
  const orderedEdges = [];
  const pathNodes = [ends[0]];
  let current = ends[0];
  while (visited.size < selected.length) {
    const edge = incident.get(current)?.find(item => !visited.has(item.id));
    if (!edge) break;
    visited.add(edge.id); orderedEdges.push(edge);
    current = edge.from === current ? edge.to : edge.from;
    pathNodes.push(current);
  }
  return visited.size === selected.length && current === ends[1]
    ? { valid: true, orderedEdges, pathNodes, internalNodeIds: pathNodes.slice(1, -1) }
    : invalid('Los componentes seleccionados no forman una cadena continua.');
}

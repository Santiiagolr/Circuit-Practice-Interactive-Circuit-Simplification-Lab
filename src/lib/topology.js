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
  const invalid = (message, kind = 'answer', code = 'invalid-selection', details = {}) => ({
    valid: false,
    status: kind === 'fault' ? 'fault' : kind === 'prerequisite' ? 'prerequisite' : kind === 'interface' ? 'interface' : 'invalid',
    message,
    kind,
    code,
    ...details,
  });
  const network = inspectTopologyNetwork(nodes, edges);
  if (!network.valid) return invalid(network.message, 'fault', network.code);
  if (!['series', 'parallel'].includes(rule)) return invalid('Acción no reconocida.', 'interface', 'unknown-rule');
  if (!Array.isArray(ids) || ids.length < 2) return invalid('Seleccioná al menos dos componentes distintos.', 'interface', 'too-few-components');
  if (new Set(ids).size !== ids.length) return invalid('Seleccioná cada componente una sola vez.', 'interface', 'duplicate-selection');
  const map = new Map(edges.map(edge => [edge.id, edge]));
  const selected = ids.map(id => map.get(id));
  if (selected.some(edge => !edge)) return invalid('La selección cambió. Volvé a seleccionar los componentes.', 'interface', 'stale-selection');
  if (selected.some(edge => edge.compType === 'S' && edge.switchState === 'open')) {
    return invalid('Eliminá primero el interruptor abierto; esa rama no conduce.', 'prerequisite', 'open-switch-first', { ids: selected.filter(edge => edge.compType === 'S' && edge.switchState === 'open').map(edge => edge.id) });
  }
  if (rule === 'parallel') {
    const first = selected[0];
    if (!selected.every(edge => edge.from !== edge.to && ((edge.from === first.from && edge.to === first.to) || (edge.from === first.to && edge.to === first.from)))) {
      return invalid('En paralelo, todos los componentes deben conectar los mismos dos nodos.', 'answer', 'parallel-node-pair-mismatch');
    }
    const nodePair = [first.from, first.to].sort();
    return { valid: true, status: 'valid', code: 'parallel-same-node-pair', orderedEdges: selected, pathNodes: nodePair, certificate: createCertificate(nodes, edges, selected.map(edge => edge.id), rule, nodePair) };
  }
  const incident = new Map();
  for (const edge of selected) for (const id of [edge.from, edge.to]) incident.set(id, [...(incident.get(id) || []), edge]);
  const ends = [];
  for (const [id, attached] of incident) {
    if (attached.length === 1) { ends.push(id); continue; }
    if (attached.length !== 2) return invalid('La selección se bifurca: una serie debe ser una única cadena.', 'answer', 'series-selection-branch');
    if (network.terminals.has(id)) return invalid('La cadena atraviesa un terminal de la batería.', 'answer', 'series-through-source');
    const degree = edges.filter(edge => edge.from === id || edge.to === id).length;
    if (degree !== 2) return invalid(`El nodo intermedio tiene ${degree} conexiones: hay una derivación, no una serie.`, 'answer', 'series-intermediate-branch', { nodeId: id, degree });
  }
  if (ends.length !== 2) return invalid('La selección debe formar una cadena continua, no un lazo cerrado.', 'answer', 'series-not-open-chain');
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
  if (visited.size !== selected.length || current !== ends[1]) return invalid('Los componentes seleccionados no forman una cadena continua.', 'answer', 'series-disconnected-selection');
  const certificate = createCertificate(nodes, edges, orderedEdges.map(edge => edge.id), rule, pathNodes);
  return { valid: true, status: 'valid', code: 'series-single-path', orderedEdges, pathNodes, internalNodeIds: pathNodes.slice(1, -1), certificate };
}

/** Validate the identity graph before using it as electrical evidence. */
export function inspectTopologyNetwork(nodes, edges) {
  const fault = (code, message) => ({ valid: false, status: 'fault', code, message });
  if (!Array.isArray(nodes) || !Array.isArray(edges) || nodes.length < 2 || edges.length < 1) {
    return fault('malformed-network', 'El circuito no contiene una red válida de nodos y componentes.');
  }
  const nodeById = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || node.id.length === 0 || nodeById.has(node.id)) {
      return fault('invalid-node-identity', 'El circuito contiene un nodo sin identidad única.');
    }
    nodeById.set(node.id, node);
  }
  const source = nodeById.get('A'), sink = nodeById.get('B');
  const isTerminal = (node, id) => node?.terminal === true || node?.terminal === id;
  if (!isTerminal(source, 'A') || !isTerminal(sink, 'B')) {
    return fault('invalid-source-terminals', 'Los terminales positivos y negativos de la fuente no están íntegros.');
  }
  if (nodes.some(node => node.id !== 'A' && node.id !== 'B' && node.terminal != null && node.terminal !== false)) {
    return fault('unexpected-terminal', 'El circuito declara un terminal de fuente inesperado.');
  }
  const edgeIds = new Set();
  const adjacency = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    if (!edge || typeof edge.id !== 'string' || edge.id.length === 0 || edgeIds.has(edge.id)) {
      return fault('invalid-component-identity', 'El circuito contiene un componente sin identidad única.');
    }
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || !nodeById.has(edge.from) || !nodeById.has(edge.to)) {
      return fault('missing-component-node', `El componente ${edge.id} referencia un nodo inexistente.`);
    }
    if (edge.from === edge.to) return fault('self-connected-component', `El componente ${edge.id} conecta un nodo consigo mismo.`);
    edgeIds.add(edge.id);
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }
  const reachable = new Set(['A']), queue = ['A'];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const next of adjacency.get(queue[cursor])) if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
  }
  if (!reachable.has('B') || reachable.size !== nodes.length) {
    return fault('disconnected-network', 'La red no conecta ambos terminales o contiene nodos desprendidos.');
  }
  return { valid: true, status: 'valid', code: 'well-formed-network', nodeById, edgeIds, terminals: new Set(['A', 'B']), adjacency };
}

function topologySignature(nodes, edges) {
  const nodeState = nodes.map(node => [node.id, node.terminal ?? null]).sort((a, b) => a[0].localeCompare(b[0]));
  const edgeState = edges.map(edge => [edge.id, edge.from, edge.to, edge.compType ?? null, edge.switchState ?? null]).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify([nodeState, edgeState]);
}

function createCertificate(nodes, edges, orderedIds, rule, witness) {
  return { version: 1, rule, orderedIds: [...orderedIds], witness: [...witness], topologySignature: topologySignature(nodes, edges) };
}

/** Independently check a proposed topology witness before it can authorize a reduction. */
export function verifyTopologyCertificate(nodes, edges, ids, rule, certificate) {
  const invalid = (code, message) => ({ valid: false, status: 'fault', code, message });
  const network = inspectTopologyNetwork(nodes, edges);
  if (!network.valid) return invalid(network.code, network.message);
  if (!certificate || certificate.version !== 1 || certificate.rule !== rule || !Array.isArray(ids) || !Array.isArray(certificate.orderedIds) || !Array.isArray(certificate.witness)) {
    return invalid('missing-topology-certificate', 'La reducción no tiene una justificación topológica verificable.');
  }
  if (topologySignature(nodes, edges) !== certificate.topologySignature) return invalid('stale-topology-certificate', 'El circuito cambió después de validar la selección.');
  if (ids.length !== certificate.orderedIds.length || new Set(ids).size !== ids.length || ids.some(id => !certificate.orderedIds.includes(id))) {
    return invalid('certificate-selection-mismatch', 'La justificación no corresponde a los componentes seleccionados.');
  }
  const byId = new Map(edges.map(edge => [edge.id, edge]));
  const selected = certificate.orderedIds.map(id => byId.get(id));
  if (selected.some(edge => !edge)) return invalid('certificate-component-missing', 'La justificación menciona un componente que ya no existe.');
  if (rule === 'parallel') {
    if (certificate.witness.length !== 2 || certificate.witness[0] === certificate.witness[1]) return invalid('invalid-parallel-witness', 'La justificación de paralelo no tiene dos nodos distintos.');
    const [first, second] = certificate.witness;
    if (selected.some(edge => !((edge.from === first && edge.to === second) || (edge.from === second && edge.to === first)))) {
      return invalid('parallel-certificate-mismatch', 'Los componentes no comparten exactamente los dos nodos indicados.');
    }
    return { valid: true, status: 'valid', code: 'verified-parallel-certificate', selected, witness: [first, second] };
  }
  if (rule !== 'series') return invalid('unknown-certificate-rule', 'La justificación usa una regla desconocida.');

  // The verifier uses cycle rank and vertex degrees rather than the producer's path walk.
  const degree = new Map(), adjacency = new Map();
  for (const edge of selected) {
    if (edge.from === edge.to) return invalid('series-self-loop', 'Un componente cerrado sobre sí mismo no forma una serie.');
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
    adjacency.set(edge.from, [...(adjacency.get(edge.from) || []), edge.to]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) || []), edge.from]);
  }
  const endpoints = [...degree].filter(([, count]) => count === 1).map(([id]) => id).sort();
  if (endpoints.length !== 2 || [...degree.values()].some(count => count > 2 || count < 1)) return invalid('series-not-a-path', 'Los componentes seleccionados no forman un camino simple.');
  const start = endpoints[0], visited = new Set([start]), queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const next of adjacency.get(queue[cursor]) || []) if (!visited.has(next)) { visited.add(next); queue.push(next); }
  }
  if (visited.size !== degree.size || selected.length !== degree.size - 1) return invalid('series-disconnected-or-cyclic', 'La selección contiene un ciclo o más de una cadena.');
  const interior = [...degree].filter(([, count]) => count === 2).map(([id]) => id);
  if (interior.some(id => network.terminals.has(id) || network.adjacency.get(id).length !== 2)) return invalid('series-external-branch', 'Un nodo intermedio tiene otra conexión o pertenece a la fuente.');
  let current = start;
  const witness = [current], consumed = new Set();
  while (consumed.size < selected.length) {
    const edge = selected.find(item => !consumed.has(item.id) && (item.from === current || item.to === current));
    if (!edge) return invalid('series-witness-disconnected', 'La ruta certificada no recorre toda la selección.');
    consumed.add(edge.id);
    current = edge.from === current ? edge.to : edge.from;
    witness.push(current);
  }
  const sameWitness = (candidate, expected) => candidate.length === expected.length && candidate.every((id, index) => id === expected[index]);
  const reversedWitness = [...certificate.witness].reverse();
  if (current !== endpoints[1] || (!sameWitness(witness, certificate.witness) && !sameWitness(witness, reversedWitness))) {
    return invalid('series-witness-mismatch', 'La ruta certificada no coincide con el camino real.');
  }
  return { valid: true, status: 'valid', code: 'verified-series-certificate', selected, witness };
}

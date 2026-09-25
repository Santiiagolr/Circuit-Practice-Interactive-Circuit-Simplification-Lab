// Independent truth table for the graph definition; never imports production topology code.
export function classifyFromDefinition(nodes, edges, selectedIds, rule) {
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(selectedIds) || selectedIds.length < 2) return false;
  const nodeById = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || nodeById.has(node.id)) return false;
    nodeById.set(node.id, node);
  }
  if (!['A', 'B'].every(id => nodeById.has(id) && (nodeById.get(id).terminal === true || nodeById.get(id).terminal === id))) return false;
  const componentById = new Map();
  const wholeAdjacency = new Map(nodes.map(node => [node.id, []]));
  for (const component of edges) {
    if (!component || typeof component.id !== 'string' || componentById.has(component.id) || component.from === component.to || !wholeAdjacency.has(component.from) || !wholeAdjacency.has(component.to)) return false;
    componentById.set(component.id, component);
    wholeAdjacency.get(component.from).push(component.to);
    wholeAdjacency.get(component.to).push(component.from);
  }
  const reachable = new Set(['A']), frontier = ['A'];
  for (let i = 0; i < frontier.length; i += 1) for (const next of wholeAdjacency.get(frontier[i])) if (!reachable.has(next)) { reachable.add(next); frontier.push(next); }
  if (!reachable.has('B') || reachable.size !== nodes.length) return false;
  if (new Set(selectedIds).size !== selectedIds.length) return false;
  const selected = selectedIds.map(id => componentById.get(id));
  if (selected.some(component => !component)) return false;

  if (rule === 'parallel') {
    const [first, ...rest] = selected;
    return first.from !== first.to && rest.every(component => (
      (component.from === first.from && component.to === first.to)
      || (component.from === first.to && component.to === first.from)
    ));
  }
  if (rule !== 'series') return false;

  const selectedAdjacency = new Map(), degree = new Map();
  for (const component of selected) {
    for (const [from, to] of [[component.from, component.to], [component.to, component.from]]) {
      selectedAdjacency.set(from, [...(selectedAdjacency.get(from) || []), to]);
      degree.set(from, (degree.get(from) || 0) + 1);
    }
  }
  const ends = [...degree].filter(([, count]) => count === 1).map(([id]) => id);
  if (ends.length !== 2 || [...degree.values()].some(count => count > 2)) return false;
  for (const [id, count] of degree) {
    if (count !== 2) continue;
    const node = nodeById.get(id);
    const terminal = id === 'A' || id === 'B' || node.terminal === true || node.terminal === 'A' || node.terminal === 'B';
    if (terminal || (wholeAdjacency.get(id) || []).length !== 2) return false;
  }
  const visited = new Set([ends[0]]), stack = [ends[0]];
  for (let i = 0; i < stack.length; i += 1) for (const next of selectedAdjacency.get(stack[i]) || []) if (!visited.has(next)) { visited.add(next); stack.push(next); }
  return visited.size === degree.size && selected.length === degree.size - 1;
}

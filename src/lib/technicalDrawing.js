import { astToNetwork } from './topology.js';
import { makeEdgeGeometry, pointsToPath } from './svgGeometry.js';
import { formatExact } from './values.js';

const same = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
const point = (x, y) => ({ x, y });
export function simplifyRoute(route) {
  const result = [];
  for (const p of route) {
    if (result.length && same(result.at(-1), p)) continue;
    while (result.length > 1) {
      const a = result.at(-2), b = result.at(-1);
      if (Math.abs((b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x)) > 0.01) break;
      if ((b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < 0) break;
      result.pop();
    }
    result.push(p);
  }
  return result;
}

// A node may be a drawn bus, not just one point. All its ports are the SAME
// electrical node. Bus conductors never appear in the selectable edge list.
export function layoutNetwork(tree, family = 0) {
  const { nodes, edges } = astToNetwork(tree);
  const byId = new Map(edges.map(edge => [edge.id, edge]));
  const measurements = new Map();
  function measure(node) {
    if (node.type === 'leaf') { const size = { w: 144, h: 128 }; measurements.set(node.id, size); return size; }
    const sizes = node.children.map(measure);
    const size = node.type === 'series'
      ? { w: sizes.reduce((sum, s) => sum + s.w, 0), h: Math.max(...sizes.map(s => s.h)) }
      : { w: Math.max(...sizes.map(s => s.w)) + 96, h: sizes.reduce((sum, s) => sum + s.h, 0) + 32 * (sizes.length - 1) };
    measurements.set(node.id, size); return size;
  }
  const size = measure(tree);
  const buses = new Map(nodes.map(node => [node.id, { id: node.id, axis: 'y', x: 0 }]));
  function place(node, x, y, w, h) {
    if (node.type === 'leaf') {
      const edge = byId.get(node.id);
      edge.route = [point(x, y + h / 2), point(x + w, y + h / 2)];
      return;
    }
    if (node.type === 'series') {
      let cursor = x;
      const own = measurements.get(node.id);
      node.children.forEach(child => {
        const cw = measurements.get(child.id).w * w / own.w;
        place(child, cursor, y, cw, h); cursor += cw;
      });
    } else {
      let cursor = y;
      node.children.forEach(child => {
        const ch = measurements.get(child.id).h;
        place(child, x + 48, cursor, w - 96, ch);
        const leaves = collectLeaves(child);
        const set = new Set(leaves.map(leaf => leaf.id));
        // Extend child terminal routes to this cell's own rails, leaving a gutter.
        const counts = new Map();
        leaves.forEach(leaf => { const edge = byId.get(leaf.id); for (const id of [edge.from, edge.to]) counts.set(id, (counts.get(id) || 0) + 1); });
        const graphEdges = edges.filter(edge => set.has(edge.id));
        const first = graphEdges[0].from, last = graphEdges.at(-1).to;
        graphEdges.forEach(edge => {
          if (edge.from === first) edge.route[0] = point(x, edge.route[0].y);
          if (edge.to === last) edge.route[edge.route.length - 1] = point(x + w, edge.route.at(-1).y);
        });
        cursor += ch + 32;
      });
    }
  }
  place(tree, 60, 60, size.w, size.h);
  // Triangle cells replace exactly P(X,S(X,X)); their diagonal is part of the
  // electrical branch between the same terminal nodes, not a decorative wire.
  if (family >= 4) {
    function triangle(node) {
      if (node.type === 'leaf') return;
      const direct = node.children.find(child => child.type === 'leaf');
      const chain = node.children.find(child => child.type === 'series' && child.children.length === 2 && child.children.every(item => item.type === 'leaf'));
      if (node.type === 'parallel' && node.children.length === 2 && direct && chain) {
        const d = byId.get(direct.id), a = byId.get(chain.children[0].id), b = byId.get(chain.children[1].id);
        const start = { ...d.route[0] };
        // Keep the series branch on its reserved orthogonal cell. Choose its
        // existing terminal ports for the diagonal so the terminal buses remain
        // connected without laying a component over a bus conductor.
        const diagonalStart = family === 5 ? a.route[0] : start;
        const diagonalEnd = family === 5 ? d.route.at(-1) : b.route.at(-1);
        d.route = [diagonalStart, diagonalEnd];
      } else node.children.forEach(triangle);
    }
    triangle(tree);
  }
  edges.forEach(edge => { edge.route = simplifyRoute(edge.route); });
  for (const node of nodes) {
    const ports = edges.flatMap(edge => edge.from === node.id ? [edge.route[0]] : edge.to === node.id ? [edge.route.at(-1)] : []);
    const x = ports[0].x;
    node.x = x; node.y = ports.reduce((sum, p) => sum + p.y, 0) / ports.length;
    buses.set(node.id, { id: node.id, axis: 'y', x });
  }
  let source = { a: point(60, 60 + size.h / 2), b: point(60 + size.w, 60 + size.h / 2), bottom: 60 + size.h + 74 };
  // Stacked cells and crossbars are quarter-turns of the reserved cell layout.
  // Electrical IDs/signatures are deliberately unaffected by this transform.
  const rotate = family === 2 || family === 3;
  if (rotate) {
    const transform = p => point(60 + size.h - (p.y - 60), p.x);
    edges.forEach(edge => { edge.route = edge.route.map(transform); });
    nodes.forEach(node => { Object.assign(node, transform(node)); });
    for (const bus of buses.values()) { const node = nodes.find(n => n.id === bus.id); bus.axis = 'x'; bus.y = node.y; delete bus.x; }
    source = { a: transform(source.a), b: transform(source.b), side: 60 + size.h + 100 };
  }
  let sourceRoute, width, height;
  if (rotate) {
    width = size.h + 220; height = size.w + 120;
    if (family === 3) {
      const reflectX = p => point(width - p.x, p.y);
      edges.forEach(edge => { edge.route = edge.route.map(reflectX); });
      nodes.forEach(node => Object.assign(node, reflectX(node)));
    }
    const terminalPorts = id => edges.flatMap(edge => edge.from === id ? [edge.route[0]] : edge.to === id ? [edge.route.at(-1)] : []);
    const portA = terminalPorts('A'), portB = terminalPorts('B');
    const a = point(Math.min(...portA.map(p => p.x)), nodes.find(n => n.id === 'A').y);
    const b = point(Math.max(...portB.map(p => p.x)), nodes.find(n => n.id === 'B').y);
    const left = Math.min(a.x, b.x) - 32, right = Math.max(a.x, b.x) + 32;
    const bottom = Math.max(...edges.flatMap(edge => edge.route.map(p => p.y))) + 64;
    sourceRoute = [a, point(left, a.y), point(left, bottom), point(right, bottom), point(right, b.y), b];
    width = Math.max(width, right + 48); height = Math.max(height, bottom + 66);
  } else {
    sourceRoute = [source.a, point(28, source.a.y), point(28, source.bottom), point(92 + size.w, source.bottom), point(92 + size.w, source.b.y), source.b];
    width = size.w + 120; height = size.h + 194;
  }
  return { nodes, edges, buses: [...buses.values()], sourceRoute, bounds: { width, height } };
}
function collectLeaves(node) { return node.type === 'leaf' ? [node] : node.children.flatMap(collectLeaves); }

export function nodePorts(exercise, id) {
  const ports = exercise.edges.flatMap(edge => edge.from === id ? [edge.route[0]] : edge.to === id ? [edge.route.at(-1)] : []);
  if (id === 'A') ports.push(exercise.sourceRoute[0]);
  if (id === 'B') ports.push(exercise.sourceRoute.at(-1));
  return ports;
}
export function routeBetweenPorts(exercise, id, start, end) {
  const bus = exercise.buses.find(item => item.id === id);
  return simplifyRoute(bus?.axis === 'x' ? [start, point(start.x, bus.y), point(end.x, bus.y), end] : [start, point(bus?.x ?? start.x, start.y), point(bus?.x ?? end.x, end.y), end]);
}
export function busRoutes(exercise) {
  return exercise.nodes.map(node => {
    const ports = nodePorts(exercise, node.id);
    const bus = exercise.buses.find(item => item.id === node.id);
    if (ports.length < 2) return { id: node.id, route: ports };
    return { id: node.id, route: bus.axis === 'x'
      ? [point(Math.min(...ports.map(p => p.x)), bus.y), point(Math.max(...ports.map(p => p.x)), bus.y)]
      : [point(bus.x, Math.min(...ports.map(p => p.y))), point(bus.x, Math.max(...ports.map(p => p.y)))] };
  }).filter(bus => bus.route.length === 2 && !same(bus.route[0], bus.route[1]));
}
function segments(route) { return route.slice(1).map((p, i) => [route[i], p]); }
function intersectsBox(a, b, box, pad = 0) {
  // Liang–Barsky clipping handles horizontal, vertical and diagonal segments.
  const x0 = box.x - pad, x1 = box.x + box.w + pad, y0 = box.y - pad, y1 = box.y + box.h + pad;
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy], q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else { const r = q[i] / p[i]; if (p[i] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); if (t0 > t1) return false; }
  }
  return true;
}
const boxesOverlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
export function drawingGeometry(exercise, scale = null) {
  const buses = busRoutes(exercise);
  const paths = [...exercise.edges.map(edge => ({ id: edge.id, route: edge.route })), ...buses, { id: 'source', route: exercise.sourceRoute }];
  const responsive = Number.isFinite(scale) && scale > 0;
  const symbolLength = responsive ? Math.max(38, 12 / scale) : 38;
  const geometries = exercise.edges.map(edge => ({ edge, ...makeEdgeGeometry(simplifyRoute(edge.route), { symbolLength, symbolBaseLength: 38 }) }));
  const occupied = geometries.map(g => {
    const angle = g.angle * Math.PI / 180, length = g.symbolScale * 38;
    const w = Math.max(48, Math.abs(Math.cos(angle)) * length + Math.abs(Math.sin(angle)) * 24 + 8);
    const h = Math.max(48, Math.abs(Math.sin(angle)) * length + Math.abs(Math.cos(angle)) * 24 + 8);
    return { x: g.centerX - w / 2, y: g.centerY - h / 2, w, h };
  });
  const labels = [];
  for (const [geometryIndex, geometry] of geometries.entries()) {
    const { centerX: x, centerY: y, angle } = geometry;
    const vertical = Math.abs(Math.sin(angle * Math.PI / 180)) > 0.8;
    const idSize = responsive ? Math.max(14, 11 / scale) : 14;
    const valueSize = responsive ? Math.max(12, 10 / scale) : 12;
    const showValue = !responsive || scale >= 0.5;
    const labelWidth = responsive
      ? Math.max(vertical ? 96 : 112, geometry.edge.label.length * idSize * 0.63 + 16, showValue ? formatExact(geometry.edge.value, exercise.settings, true).length * valueSize * 0.63 + 16 : 0)
      : vertical ? 96 : 112;
    const labelHeight = responsive ? 8 + idSize + (showValue ? valueSize + 4 : 0) : 34;
    const options = responsive
      ? vertical
        ? [[18, -labelHeight / 2], [-labelWidth - 18, -labelHeight / 2], [18, -labelHeight - 24], [-labelWidth - 18, -labelHeight - 24], [18, 24], [-labelWidth - 18, 24]]
        : [[-labelWidth / 2, -labelHeight - 28], [-labelWidth / 2, 28], [-labelWidth - 28, -labelHeight - 28], [28, 28], [-labelWidth / 2, -labelHeight - 58], [-labelWidth / 2, 58]]
      : vertical
        ? [[12, -17], [-labelWidth - 12, -17], [12, -57], [-labelWidth - 12, -57], [12, 21], [-labelWidth - 12, 21]]
        : [[-56, -64], [-56, 30], [-112, -64], [0, 30]];
    let box = null;
    for (const [dx, dy] of options) {
      const candidate = { x: x + dx, y: y + dy, w: labelWidth, h: labelHeight, idSize, valueSize, showValue };
      if (candidate.x < 4 || candidate.y < 4 || candidate.x + candidate.w > exercise.bounds.width - 4 || candidate.y + candidate.h > exercise.bounds.height - 4) continue;
      if (occupied.some((item, index) => index !== geometryIndex && boxesOverlap(item, candidate, 2)) || labels.some(item => boxesOverlap(item, candidate, 5))) continue;
      if (paths.some(path => segments(path.route).some(([a, b]) => intersectsBox(a, b, candidate, 3)))) continue;
      box = candidate; break;
    }
    geometry.labelBox = box;
    if (box) labels.push(box);
  }
  return { geometries, buses, paths, hiddenLabels: geometries.length - labels.length };
}
function segmentIntersection(a, b, c, d) {
  const cross = (x, y, z) => (y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x);
  const p = cross(a, b, c), q = cross(a, b, d), r = cross(c, d, a), s = cross(c, d, b);
  const on = (x, y, z) => Math.abs(cross(x, y, z)) < 0.01 && z.x >= Math.min(x.x, y.x) - 0.01 && z.x <= Math.max(x.x, y.x) + 0.01 && z.y >= Math.min(x.y, y.y) - 0.01 && z.y <= Math.max(x.y, y.y) + 0.01;
  if ((p > 0 && q < 0 || p < 0 && q > 0) && (r > 0 && s < 0 || r < 0 && s > 0)) return 'cross';
  if (Math.abs(p) < 0.01 && Math.abs(q) < 0.01) {
    const axis = Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? 'x' : 'y';
    const length = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) - Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
    if (length > 0.01) return 'overlap';
  }
  return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b) ? 'touch' : null;
}
export function inspectDrawing(exercise) {
  const issues = [];
  const geometry = drawingGeometry(exercise);
  for (const g of geometry.geometries) if (!g.labelBox) issues.push({ type: 'label-space', id: g.edge.id });
  const paths = geometry.paths;
  const electricalIds = path => path.id === 'source' ? ['A', 'B'] : exercise.edges.find(e => e.id === path.id) ? [exercise.edges.find(e => e.id === path.id).from, exercise.edges.find(e => e.id === path.id).to] : [path.id];
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (path.route.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) issues.push({ type: 'invalid-coordinate', id: path.id });
    for (let j = i + 1; j < paths.length; j++) {
      const other = paths[j], common = electricalIds(path).filter(id => electricalIds(other).includes(id));
      for (const [a, b] of segments(path.route)) for (const [c, d] of segments(other.route)) {
        const intersection = segmentIntersection(a, b, c, d);
        if (!intersection) continue;
        // Only touches at shared electrical nodes/buses are permissible.
        if (intersection === 'touch' && common.some(id => {
          const ports = nodePorts(exercise, id);
          return ports.some(p => [a, b, c, d].some(v => same(p, v)) && intersectsBox(a, b, { x: p.x - .01, y: p.y - .01, w: .02, h: .02 }) && intersectsBox(c, d, { x: p.x - .01, y: p.y - .01, w: .02, h: .02 }));
        })) continue;
        issues.push({ type: intersection, ids: [path.id, other.id] });
      }
    }
  }
  for (const edge of exercise.edges) {
    for (const [id, p] of [[edge.from, edge.route[0]], [edge.to, edge.route.at(-1)]]) {
      const bus = exercise.buses.find(b => b.id === id);
      if (!bus || (bus.axis === 'x' ? Math.abs(p.y - bus.y) : Math.abs(p.x - bus.x)) > .01) issues.push({ type: 'detached', id: edge.id });
    }
  }
  return issues;
}
export { pointsToPath };

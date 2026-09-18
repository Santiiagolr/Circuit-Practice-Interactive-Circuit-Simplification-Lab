import React, { useId, useMemo } from 'react';
import { formatValue } from '../lib/graphCircuit';

// The drawing uses a compact, regular coordinate system. The graph generator
// owns the topology and the exact route; this component maps it to pixels and
// adds the interactive presentation layer.
const GRID_SPACING_X = 82;
const GRID_SPACING_Y = 62;
const PADDING = 64;
const SYMBOL_LEN = 38;
const COLORS = {
  wire: '#526B80',
  ink: '#183047',
  selected: '#37D6C0',
  equivalent: '#FFB454',
  resistor: '#D98C42',
  capacitor: '#2AA9B8',
  switch: '#9B72C7',
  open: '#EF7770',
};

function getSymbolColor(edge, isSelected, isEquivalent) {
  if (isSelected) return COLORS.selected;
  if (isEquivalent) return COLORS.equivalent;
  if (edge.compType === 'S') return edge.switchState === 'open' ? COLORS.open : COLORS.switch;
  if (edge.compType === 'C') return COLORS.capacitor;
  if (edge.compType === 'R') return COLORS.resistor;
  return COLORS.wire;
}

function SvgDefs({ prefix }) {
  return (
    <defs>
      <filter id={prefix + '-selected'} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={COLORS.selected} floodOpacity="0.7" />
      </filter>
      <filter id={prefix + '-equivalent'} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={COLORS.equivalent} floodOpacity="0.65" />
      </filter>
      <filter id={prefix + '-battery-glow'} x="-80%" y="-80%" width="260%" height="260%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFB454" floodOpacity="0.45" />
      </filter>
      <pattern id={prefix + '-grid'} width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#B8CBD5" strokeWidth="0.55" opacity="0.55" />
      </pattern>
      <pattern id={prefix + '-grid-major'} width="120" height="120" patternUnits="userSpaceOnUse">
        <rect width="120" height="120" fill={'url(#' + prefix + '-grid)'} />
        <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#8FA9B7" strokeWidth="0.75" opacity="0.5" />
      </pattern>
    </defs>
  );
}

function ZigZagSymbol({ color, scale = 1 }) {
  const halfLength = SYMBOL_LEN / 2;
  const amplitude = 6;
  const peaks = 5;
  const segmentWidth = SYMBOL_LEN / peaks;
  let points = String(-halfLength) + ',0';

  for (let index = 0; index < peaks; index += 1) {
    const xOffset = -halfLength + segmentWidth * index;
    const direction = index % 2 === 0 ? -1 : 1;
    points += ' ' + (xOffset + segmentWidth / 2) + ',' + direction * amplitude;
    points += ' ' + (xOffset + segmentWidth) + ',0';
  }

  return (
    <polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      transform={'scale(' + scale + ')'}
    />
  );
}

function PlatesSymbol({ color, scale = 1 }) {
  const halfLength = SYMBOL_LEN / 2;
  const gap = 8;
  const plateHeight = 17;

  return (
    <g pointerEvents="none" transform={'scale(' + scale + ')'}>
      <line x1={-halfLength} y1="0" x2={-gap / 2} y2="0" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={-gap / 2} y1={-plateHeight / 2} x2={-gap / 2} y2={plateHeight / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={gap / 2} y1={-plateHeight / 2} x2={gap / 2} y2={plateHeight / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={gap / 2} y1="0" x2={halfLength} y2="0" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function SwitchSymbol({ color, switchState, scale = 1 }) {
  const isOpen = switchState === 'open';

  return (
    <g pointerEvents="none" transform={'scale(' + scale + ')'}>
      <circle cx="-11" cy="0" r="3" fill="#FFFFFF" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx="11" cy="0" r="3" fill="#FFFFFF" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line
        x1="-11"
        y1="0"
        x2={isOpen ? 6 : 11}
        y2={isOpen ? -11 : 0}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function BatterySymbol({ x, y, angle = 0, filterId }) {
  return (
    <g transform={'translate(' + x + ', ' + y + ') rotate(' + angle + ')'} pointerEvents="none" filter={'url(#' + filterId + ')'}>
      <line x1="-8" y1="-14" x2="-8" y2="14" stroke="#39546A" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1="8" y1="-23" x2="8" y2="23" stroke="#183047" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <text x="-24" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="#39546A" fontFamily="'Space Grotesk', sans-serif">−</text>
      <text x="25" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="#D98C42" fontFamily="'Space Grotesk', sans-serif">+</text>
      <text x="0" y="39" textAnchor="middle" fontSize="11" fontWeight="700" fill="#60788B" fontFamily="'IBM Plex Mono', monospace">FUENTE · 12 V</text>
    </g>
  );
}

function compactPoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.x !== previous.x || point.y !== previous.y;
  });
}

function pointsToPath(points) {
  return compactPoints(points).map((point, index) => (
    (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y
  )).join(' ');
}

function getLongestSegment(points) {
  let longest = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const length = Math.hypot(second.x - first.x, second.y - first.y);
    if (!longest || length > longest.length) {
      longest = { index, first, second, length };
    }
  }

  return longest;
}

function moveAlong(first, second, distance) {
  const length = Math.hypot(second.x - first.x, second.y - first.y);
  if (length < 1) return { ...first };
  return {
    x: first.x + ((second.x - first.x) / length) * distance,
    y: first.y + ((second.y - first.y) / length) * distance,
  };
}

function makeEdgeGeometry(routePoints) {
  const route = compactPoints(routePoints || []);
  const segment = getLongestSegment(route);
  if (!segment || segment.length < 1) return null;

  const symbolLength = Math.min(SYMBOL_LEN, segment.length * 0.58);
  const symbolHalf = symbolLength / 2;
  const center = moveAlong(segment.first, segment.second, segment.length / 2);
  const symbolStart = moveAlong(segment.first, segment.second, segment.length / 2 - symbolHalf);
  const symbolEnd = moveAlong(segment.first, segment.second, segment.length / 2 + symbolHalf);
  const firstPathPoints = compactPoints(route.slice(0, segment.index + 1).concat(symbolStart));
  const secondPathPoints = compactPoints([symbolEnd].concat(route.slice(segment.index + 1)));
  const segmentDx = (segment.second.x - segment.first.x) / segment.length;
  const segmentDy = (segment.second.y - segment.first.y) / segment.length;
  let perpX = -segmentDy;
  let perpY = segmentDx;
  if (perpY > 0) {
    perpX *= -1;
    perpY *= -1;
  }

  const labelGap = Math.max(20, Math.min(28, segment.length * 0.14));
  const labelCenterX = center.x + perpX * (labelGap + 5);
  const labelCenterY = center.y + perpY * (labelGap + 5);

  return {
    angle: Math.atan2(segmentDy, segmentDx) * (180 / Math.PI),
    centerX: center.x,
    centerY: center.y,
    symbolScale: symbolLength / SYMBOL_LEN,
    visibleFirstPath: pointsToPath(firstPathPoints),
    visibleSecondPath: pointsToPath(secondPathPoints),
    labelX: labelCenterX,
    labelY: labelCenterY - 6,
    valueX: labelCenterX,
    valueY: labelCenterY + 7,
    labelPlateX: labelCenterX - 31,
    labelPlateY: labelCenterY - 15,
    hitWidth: Math.max(72, symbolLength + 30),
    hitHeight: Math.max(42, Math.min(58, symbolLength + 18)),
  };
}

function getEdgeLabel(edge) {
  if (edge.compType === 'W') return 'Cable, cortocircuito';
  if (edge.compType === 'S') {
    return 'Interruptor ' + (edge.switchState === 'open' ? 'abierto' : 'cerrado');
  }
  return (edge.compType === 'R' ? 'Resistencia ' : 'Capacitor ')
    + edge.label + ', ' + formatValue(edge.val, edge.compType, edge.switchState);
}

function handleKeyboardSelect(event, edgeId, onClick) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    onClick(edgeId);
  }
}

function handleCircuitCanvasClick(event, onSelect) {
  const target = event.target;
  if (target.closest && target.closest('[data-component-id]')) return;

  let closest = null;
  const components = event.currentTarget.querySelectorAll('[data-component-id]');
  components.forEach((component) => {
    const hitbox = component.querySelector('[data-component-hitbox]');
    if (!hitbox) return;

    const bounds = hitbox.getBoundingClientRect();
    const distance = Math.hypot(
      event.clientX - (bounds.left + bounds.width / 2),
      event.clientY - (bounds.top + bounds.height / 2),
    );
    if (!closest || distance < closest.distance) {
      closest = { id: component.getAttribute('data-component-id'), distance };
    }
  });

  if (closest && closest.distance <= 46) {
    onSelect(closest.id);
    return;
  }

  onSelect(null);
}

function renderPath(path, key, showFlow, flowClassName = 'flow-trace') {
  if (!path) return null;
  return (
    <React.Fragment key={key}>
      <path
        d={path}
        fill="none"
        stroke={COLORS.wire}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {showFlow && (
        <path
          className={flowClassName}
          d={path}
          fill="none"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
    </React.Fragment>
  );
}

function renderFlowPath(path, key, flowClassName = 'flow-trace') {
  if (!path) return null;
  return (
    <path
      key={key}
      className={flowClassName}
      d={path}
      fill="none"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

function EdgeComponent({ edge, routePoints, isSelected, onClick, showFlow, filterIds }) {
  const geometry = makeEdgeGeometry(routePoints);
  if (!geometry) return null;

  const isEquivalent = edge.label === 'Eq' || edge.layoutRole === 'equivalent';
  const color = getSymbolColor(edge, isSelected, isEquivalent);
  const filter = isSelected
    ? 'url(#' + filterIds.selected + ')'
    : isEquivalent
      ? 'url(#' + filterIds.equivalent + ')'
      : undefined;
  const flowEnabled = showFlow && (edge.compType !== 'S' || edge.switchState === 'closed');
  const labelValue = formatValue(edge.val, edge.compType, edge.switchState);

  return (
    <g
      data-component-id={edge.id}
      className={'edge-component ' + (isSelected ? 'is-selected ' : '') + (isEquivalent ? 'is-equivalent edge-component--merge' : '')}
      role="button"
      tabIndex="0"
      aria-label={getEdgeLabel(edge)}
      aria-pressed={isSelected}
      onClick={(event) => {
        event.stopPropagation();
        onClick(edge.id);
      }}
      onKeyDown={(event) => handleKeyboardSelect(event, edge.id, onClick)}
      filter={filter}
    >
      <rect
        x={-geometry.hitWidth / 2}
        y={-geometry.hitHeight / 2}
        width={geometry.hitWidth}
        height={geometry.hitHeight}
        rx="12"
        fill="transparent"
        data-component-hitbox="true"
        pointerEvents="all"
        transform={'translate(' + geometry.centerX + ', ' + geometry.centerY + ') rotate(' + geometry.angle + ')'}
      />
      {renderPath(geometry.visibleFirstPath, edge.id + '-first', flowEnabled)}
      {renderPath(geometry.visibleSecondPath, edge.id + '-second', flowEnabled)}
      <g transform={'translate(' + geometry.centerX + ', ' + geometry.centerY + ') rotate(' + geometry.angle + ')'} pointerEvents="none">
        {edge.compType === 'W' ? (
          <line x1={-SYMBOL_LEN / 2} y1="0" x2={SYMBOL_LEN / 2} y2="0" stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" transform={'scale(' + geometry.symbolScale + ')'} />
        ) : edge.compType === 'S' ? (
          <SwitchSymbol color={color} switchState={edge.switchState} scale={geometry.symbolScale} />
        ) : edge.compType === 'R' ? (
          <ZigZagSymbol color={color} scale={geometry.symbolScale} />
        ) : (
          <PlatesSymbol color={color} scale={geometry.symbolScale} />
        )}
      </g>

      <rect
        x={geometry.labelPlateX}
        y={geometry.labelPlateY}
        width="62"
        height="30"
        rx="6"
        fill="#F7FBFC"
        fillOpacity="0.94"
        stroke={isSelected ? COLORS.selected : '#C8D8DF'}
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <text x={geometry.labelX} y={geometry.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="700" fill={COLORS.ink} fontFamily="'Space Grotesk', sans-serif" pointerEvents="none">
        {edge.label}
      </text>
      <text x={geometry.valueX} y={geometry.valueY} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="600" fill={isSelected ? '#168F82' : '#60788B'} fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">
        {labelValue}
      </text>
    </g>
  );
}

function NodeDot({ node, px, py }) {
  if (node.terminal) {
    const isPositive = node.terminal === 'A';
    const color = isPositive ? '#D98C42' : '#527D98';
    return (
      <g pointerEvents="none">
        <circle cx={px} cy={py} r="13" fill={color} opacity="0.16" />
        <circle cx={px} cy={py} r="7" fill={color} />
        <text x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="'Space Grotesk', sans-serif">
          {isPositive ? '+' : '−'}
        </text>
        <text x={px} y={py - 23} textAnchor="middle" fontSize="12" fontWeight="800" fill={color} fontFamily="'IBM Plex Mono', monospace">
          {isPositive ? 'A · 12 V' : 'B · 0 V'}
        </text>
      </g>
    );
  }

  return <circle cx={px} cy={py} r="4.5" fill={COLORS.ink} pointerEvents="none" />;
}

function getLayout(nodes, edges, sourceRoute, equivalentRoute) {
  const activeNodeIds = new Set(['A', 'B']);
  edges.forEach((edge) => {
    activeNodeIds.add(edge.from);
    activeNodeIds.add(edge.to);
  });
  const activeNodes = nodes.filter((node) => activeNodeIds.has(node.id));
  const graphPoints = activeNodes.map((node) => ({ x: node.x, y: node.y }))
    .concat(edges.flatMap((edge) => edge.route || []))
    .concat(sourceRoute || [])
    .concat(equivalentRoute || []);

  if (graphPoints.length === 0) {
    return { positions: {}, routes: {}, sourceRoute: [], width: 640, height: 420, activeNodes: [], toPixel: null };
  }

  const minX = Math.min(...graphPoints.map((point) => point.x));
  const minY = Math.min(...graphPoints.map((point) => point.y));
  const maxX = Math.max(...graphPoints.map((point) => point.x));
  const maxY = Math.max(...graphPoints.map((point) => point.y));
  const toPixel = (point) => ({
    x: PADDING + (point.x - minX) * GRID_SPACING_X,
    y: PADDING + (point.y - minY) * GRID_SPACING_Y,
  });

  const positions = Object.fromEntries(activeNodes.map((node) => [node.id, toPixel(node)]));
  const routes = Object.fromEntries(edges.map((edge) => [
    edge.id,
    (edge.route || [
      { x: edge.from === 'A' ? 0 : edge.to === 'A' ? maxX : 0, y: 0 },
      { x: edge.to === 'B' ? maxX : edge.from === 'B' ? 0 : maxX, y: 0 },
    ]).map(toPixel),
  ]));

  return {
    positions,
    routes,
    sourceRoute: (sourceRoute || []).map(toPixel),
    equivalentRoute: (equivalentRoute || []).map(toPixel),
    width: Math.max(640, PADDING * 2 + (maxX - minX) * GRID_SPACING_X),
    height: Math.max(420, PADDING * 2 + (maxY - minY) * GRID_SPACING_Y),
    activeNodes,
    toPixel,
  };
}

function renderSourceRoute(route, sourceSymbol, showFlow) {
  if (!route || route.length < 2) return null;

  const symbolY = sourceSymbol?.y;
  const symbolX = sourceSymbol?.x;
  const segments = [];
  let current = [];

  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };

  route.forEach((point, index) => {
    const next = route[index + 1];
    current.push(point);
    if (!next) return;

    const crossesBatteryGap = Number.isFinite(symbolX)
      && Number.isFinite(symbolY)
      && (
        (
          point.y === symbolY
          && next.y === symbolY
          && Math.min(point.x, next.x) <= symbolX
          && Math.max(point.x, next.x) >= symbolX
        )
        || (
          point.x === symbolX
          && next.x === symbolX
          && Math.min(point.y, next.y) <= symbolY
          && Math.max(point.y, next.y) >= symbolY
        )
      );
    if (crossesBatteryGap) flush();
  });
  flush();

  return (
    <g className="source-decoration" pointerEvents="none">
      {segments.map((segment, index) => renderPath(pointsToPath(segment), 'source-' + index, false))}
      {showFlow && segments.map((segment, index) => renderFlowPath(
        pointsToPath(segment),
        'source-flow-' + index,
        index === 0 ? 'flow-trace flow-trace--positive' : 'flow-trace',
      ))}
    </g>
  );
}

function transformSourceSymbol(sourceSymbol, layout) {
  if (!sourceSymbol || !layout.toPixel) return null;
  return {
    ...layout.toPixel(sourceSymbol),
    angle: sourceSymbol.angle || 0,
  };
}

export default function GridCircuitSVG({
  nodes,
  edges,
  selectedIds,
  onSelect,
  showFlow = false,
  sourceRoute = [],
  sourceSymbol = null,
  equivalentRoute = [],
  layout: layoutMeta = null,
}) {
  const generatedId = useId();
  const prefix = 'advanced-' + generatedId.replace(/[^a-zA-Z0-9_-]/g, '');
  const layout = useMemo(
    () => getLayout(nodes, edges, sourceRoute, equivalentRoute),
    [edges, equivalentRoute, nodes, sourceRoute],
  );
  const batteryPosition = transformSourceSymbol(sourceSymbol, layout);
  const filterIds = {
    selected: prefix + '-selected',
    equivalent: prefix + '-equivalent',
  };

  return (
    <div
      className="circuit-scroll circuit-scroll--fit"
      data-layout-family={layoutMeta?.family || undefined}
      data-layout-orientation={layoutMeta?.orientation || undefined}
    >
      <svg
        className="circuit-svg"
        width={layout.width}
        height={layout.height}
        viewBox={'0 0 ' + layout.width + ' ' + layout.height}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Circuito avanzado interactivo"
        onClick={(event) => handleCircuitCanvasClick(event, onSelect)}
      >
        <SvgDefs prefix={prefix} />
        <rect width={layout.width} height={layout.height} fill={'url(#' + prefix + '-grid-major)'} pointerEvents="all" />
        {renderSourceRoute(layout.sourceRoute, batteryPosition, showFlow)}
        {batteryPosition && (
          <BatterySymbol
            x={batteryPosition.x}
            y={batteryPosition.y}
            angle={batteryPosition.angle}
            filterId={prefix + '-battery-glow'}
          />
        )}
        {edges.map((edge) => (
          <EdgeComponent
            key={edge.id}
            edge={edge}
            routePoints={layout.routes[edge.id]}
            isSelected={selectedIds.includes(edge.id)}
            onClick={onSelect}
            showFlow={showFlow}
            filterIds={filterIds}
          />
        ))}
        {layout.activeNodes.map((node) => {
          const position = layout.positions[node.id];
          return <NodeDot key={node.id} node={node} px={position.x} py={position.y} />;
        })}
      </svg>
    </div>
  );
}

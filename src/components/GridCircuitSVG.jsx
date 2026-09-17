import React, { useId, useMemo } from 'react';
import { formatValue } from '../lib/graphCircuit';

const GRID_SPACING_X = 126;
const GRID_SPACING_Y = 110;
const PADDING = 72;
const SYMBOL_LEN = 42;
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

function seededRandom(seed) {
  let hash = 0xdeadbeef;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 2654435761);
  }
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function getParallelKey(edge) {
  return [edge.from, edge.to].sort().join('::');
}

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

function ZigZagSymbol({ color }) {
  const halfLength = SYMBOL_LEN / 2;
  const amplitude = 7;
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
    />
  );
}

function PlatesSymbol({ color }) {
  const halfLength = SYMBOL_LEN / 2;
  const gap = 8;
  const plateHeight = 17;

  return (
    <g pointerEvents="none">
      <line x1={-halfLength} y1="0" x2={-gap / 2} y2="0" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={-gap / 2} y1={-plateHeight / 2} x2={-gap / 2} y2={plateHeight / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={gap / 2} y1={-plateHeight / 2} x2={gap / 2} y2={plateHeight / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={gap / 2} y1="0" x2={halfLength} y2="0" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function SwitchSymbol({ color, switchState }) {
  const isOpen = switchState === 'open';

  return (
    <g pointerEvents="none">
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

function getEdgeLabel(edge) {
  if (edge.compType === 'W') return 'Cable, cortocircuito';
  if (edge.compType === 'S') {
    return 'Interruptor ' + (edge.switchState === 'open' ? 'abierto' : 'cerrado');
  }
  return (edge.compType === 'R' ? 'Resistencia ' : 'Capacitor ')
    + edge.label + ', ' + formatValue(edge.val, edge.compType);
}

function handleKeyboardSelect(event, edgeId, onClick) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    onClick(edgeId);
  }
}

const PARALLEL_LANE_GAP = 42;

function compactPoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.x !== previous.x || point.y !== previous.y;
  });
}

function pointsToPath(points) {
  return points.map((point, index) => (
    (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y
  )).join(' ');
}

function getParallelLayout(edge, edges) {
  const parallelEdges = edges
    .filter((candidate) => getParallelKey(candidate) === getParallelKey(edge))
    .slice()
    .sort((first, second) => first.id.localeCompare(second.id));
  const parallelIndex = parallelEdges.findIndex((candidate) => candidate.id === edge.id);
  const parallelOffset = parallelEdges.length > 1
    ? (parallelIndex - (parallelEdges.length - 1) / 2) * PARALLEL_LANE_GAP
    : 0;

  return { parallelEdges, parallelOffset };
}

function getRoutePoints(edge, edges, x1, y1, x2, y2, isMessy) {
  const { parallelEdges, parallelOffset } = getParallelLayout(edge, edges);
  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const horizontalDistance = Math.abs(x2 - x1);
  const verticalDistance = Math.abs(y2 - y1);

  if (parallelEdges.length > 1) {
    if (horizontalDistance >= verticalDistance) {
      const direction = x2 >= x1 ? 1 : -1;
      const inset = Math.min(30, Math.max(12, horizontalDistance * 0.16));
      const laneY = (y1 + y2) / 2 + parallelOffset;
      return compactPoints([
        start,
        { x: x1 + direction * inset, y: laneY },
        { x: x2 - direction * inset, y: laneY },
        end,
      ]);
    }

    const direction = y2 >= y1 ? 1 : -1;
    const inset = Math.min(30, Math.max(12, verticalDistance * 0.16));
    const laneX = (x1 + x2) / 2 + parallelOffset;
    return compactPoints([
      start,
      { x: laneX, y: y1 + direction * inset },
      { x: laneX, y: y2 - direction * inset },
      end,
    ]);
  }

  if (horizontalDistance < 1 || verticalDistance < 1) return [start, end];

  const routeStyle = edge.routeStyle || (
    isMessy && seededRandom(edge.id + '-geometric-route') > 0.62
      ? 'diagonal'
      : 'horizontal'
  );

  if (routeStyle === 'diagonal') return [start, end];

  if (routeStyle === 'vertical') {
    const middleY = (y1 + y2) / 2;
    return compactPoints([
      start,
      { x: x1, y: middleY },
      { x: x2, y: middleY },
      end,
    ]);
  }

  const middleX = (x1 + x2) / 2;
  return compactPoints([
    start,
    { x: middleX, y: y1 },
    { x: middleX, y: y2 },
    end,
  ]);
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

function makeEdgeGeometry(edge, edges, x1, y1, x2, y2, isMessy) {
  const routePoints = getRoutePoints(edge, edges, x1, y1, x2, y2, isMessy);
  const segment = getLongestSegment(routePoints);
  if (!segment || segment.length < 1) return null;

  const symbolHalf = Math.min(SYMBOL_LEN / 2, segment.length * 0.28);
  const center = moveAlong(segment.first, segment.second, segment.length / 2);
  const symbolStart = moveAlong(segment.first, segment.second, segment.length / 2 - symbolHalf);
  const symbolEnd = moveAlong(segment.first, segment.second, segment.length / 2 + symbolHalf);
  const firstPathPoints = compactPoints(routePoints.slice(0, segment.index + 1).concat(symbolStart));
  const secondPathPoints = compactPoints([symbolEnd].concat(routePoints.slice(segment.index + 1)));
  const segmentDx = (segment.second.x - segment.first.x) / segment.length;
  const segmentDy = (segment.second.y - segment.first.y) / segment.length;
  let perpX = -segmentDy;
  let perpY = segmentDx;
  if (perpY > 0) {
    perpX *= -1;
    perpY *= -1;
  }
  const { parallelEdges, parallelOffset } = getParallelLayout(edge, edges);
  const isHorizontalSymbolSegment = Math.abs(segment.second.x - segment.first.x)
    >= Math.abs(segment.second.y - segment.first.y);
  const outwardParallelOffset = parallelOffset === 0
    ? -1
    : Math.sign(parallelOffset);
  const parallelTagDistance = 24;

  return {
    angle: Math.atan2(segmentDy, segmentDx) * (180 / Math.PI),
    centerX: center.x,
    centerY: center.y,
    visibleFirstPath: pointsToPath(firstPathPoints),
    visibleSecondPath: pointsToPath(secondPathPoints),
    labelX: center.x - perpX * 25,
    labelY: center.y - perpY * 25,
    valueX: center.x + perpX * 25,
    valueY: center.y + perpY * 25,
    parallelCount: parallelEdges.length,
    tagX: isHorizontalSymbolSegment
      ? center.x
      : center.x + outwardParallelOffset * parallelTagDistance,
    tagY: isHorizontalSymbolSegment
      ? center.y + outwardParallelOffset * parallelTagDistance
      : center.y,
  };
}

function EdgeComponent({ edge, edges, x1, y1, x2, y2, isSelected, onClick, isMessy, showFlow, filterIds }) {
  const geometry = makeEdgeGeometry(edge, edges, x1, y1, x2, y2, isMessy);
  if (!geometry) return null;

  const isEquivalent = edge.label === 'Eq';
  const color = getSymbolColor(edge, isSelected, isEquivalent);
  const filter = isSelected
    ? 'url(#' + filterIds.selected + ')'
    : isEquivalent
      ? 'url(#' + filterIds.equivalent + ')'
      : undefined;
  const flowEnabled = showFlow && (edge.compType !== 'S' || edge.switchState === 'closed');
  const hitHeight = geometry.parallelCount > 1 ? 28 : 36;
  const labelValue = formatValue(edge.val, edge.compType);

  return (
    <g
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
        x="-38"
        y={-hitHeight / 2}
        width="76"
        height={hitHeight}
        rx="14"
        fill="transparent"
        pointerEvents="all"
        transform={'translate(' + geometry.centerX + ', ' + geometry.centerY + ') rotate(' + geometry.angle + ')'}
      />
      <path
        d={geometry.visibleFirstPath}
        fill="none"
        stroke={COLORS.wire}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <path
        d={geometry.visibleSecondPath}
        fill="none"
        stroke={COLORS.wire}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {flowEnabled && (
        <>
          <path className="flow-trace" d={geometry.visibleFirstPath} fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path className="flow-trace" d={geometry.visibleSecondPath} fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
      <g transform={'translate(' + geometry.centerX + ', ' + geometry.centerY + ') rotate(' + geometry.angle + ')'} pointerEvents="none">
        {edge.compType === 'W' ? (
          <line x1={-SYMBOL_LEN / 2} y1="0" x2={SYMBOL_LEN / 2} y2="0" stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ) : edge.compType === 'S' ? (
          <SwitchSymbol color={color} switchState={edge.switchState} />
        ) : edge.compType === 'R' ? (
          <ZigZagSymbol color={color} />
        ) : (
          <PlatesSymbol color={color} />
        )}
      </g>

      {geometry.parallelCount > 1 ? (
        <g transform={'translate(' + geometry.tagX + ', ' + geometry.tagY + ')'} pointerEvents="none">
          <rect x="-42" y="-10" width="84" height="20" rx="7" fill="#FFFFFF" fillOpacity="0.88" stroke="#D1E0E7" strokeWidth="0.8" />
          <text textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="700" fill={isSelected ? '#168F82' : COLORS.ink} fontFamily="'IBM Plex Mono', monospace">
            {edge.label + ' · ' + labelValue}
          </text>
        </g>
      ) : (
        <>
          <text x={geometry.labelX} y={geometry.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="700" fill={COLORS.ink} fontFamily="'Space Grotesk', sans-serif" pointerEvents="none">
            {edge.label}
          </text>
          <text x={geometry.valueX} y={geometry.valueY} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="600" fill={isSelected ? '#168F82' : '#60788B'} fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">
            {labelValue}
          </text>
        </>
      )}
    </g>
  );
}

function NodeDot({ node, px, py }) {
  if (node.terminal) {
    const isPositive = node.terminal === 'A';
    const color = isPositive ? '#D98C42' : '#527D98';
    return (
      <g pointerEvents="none">
        <circle cx={px} cy={py} r="12" fill={color} opacity="0.16" />
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

function getLayout(nodes, edges) {
  const activeNodeIds = new Set(['A', 'B']);
  edges.forEach((edge) => {
    activeNodeIds.add(edge.from);
    activeNodeIds.add(edge.to);
  });
  const activeNodes = nodes.filter((node) => activeNodeIds.has(node.id));

  if (activeNodes.length === 0) {
    return { positions: {}, width: 480, height: 360, activeNodes: [] };
  }

  const minX = Math.min(...activeNodes.map((node) => node.x));
  const minY = Math.min(...activeNodes.map((node) => node.y));
  const maxX = Math.max(...activeNodes.map((node) => node.x));
  const maxY = Math.max(...activeNodes.map((node) => node.y));
  const positions = Object.fromEntries(activeNodes.map((node) => [
    node.id,
    {
      px: PADDING + (node.x - minX) * GRID_SPACING_X,
      py: PADDING + (node.y - minY) * GRID_SPACING_Y,
    },
  ]));

  return {
    positions,
    activeNodes,
    width: Math.max(480, PADDING * 2 + (maxX - minX) * GRID_SPACING_X),
    height: Math.max(360, PADDING * 2 + (maxY - minY) * GRID_SPACING_Y),
  };
}

export default function GridCircuitSVG({ nodes, edges, selectedIds, onSelect, isMessy, showFlow = false }) {
  const generatedId = useId();
  const prefix = 'advanced-' + generatedId.replace(/[^a-zA-Z0-9_-]/g, '');
  const layout = useMemo(() => getLayout(nodes, edges), [edges, nodes]);
  const filterIds = {
    selected: prefix + '-selected',
    equivalent: prefix + '-equivalent',
  };

  return (
    <div className="circuit-scroll">
      <svg
        className="circuit-svg"
        width={layout.width}
        height={layout.height}
        viewBox={'0 0 ' + layout.width + ' ' + layout.height}
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: Math.max(450, Math.min(layout.width, 980)) + 'px' }}
        role="group"
        aria-label="Circuito avanzado interactivo"
        onClick={() => onSelect(null)}
      >
        <SvgDefs prefix={prefix} />
        <rect width={layout.width} height={layout.height} fill={'url(#' + prefix + '-grid-major)'} pointerEvents="all" />
        {edges.map((edge) => {
          const start = layout.positions[edge.from];
          const end = layout.positions[edge.to];
          if (!start || !end) return null;
          return (
            <EdgeComponent
              key={edge.id}
              edge={edge}
              edges={edges}
              x1={start.px}
              y1={start.py}
              x2={end.px}
              y2={end.py}
              isSelected={selectedIds.includes(edge.id)}
              onClick={onSelect}
              isMessy={isMessy}
              showFlow={showFlow}
              filterIds={filterIds}
            />
          );
        })}
        {layout.activeNodes.map((node) => {
          const position = layout.positions[node.id];
          return <NodeDot key={node.id} node={node} px={position.px} py={position.py} />;
        })}
      </svg>
    </div>
  );
}

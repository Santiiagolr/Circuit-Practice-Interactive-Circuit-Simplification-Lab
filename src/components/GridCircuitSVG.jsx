import React, { useId, useMemo } from 'react';
import { formatValue } from '../lib/graphCircuit';

const GRID_SPACING_X = 176;
const GRID_SPACING_Y = 154;
const PADDING = 118;
const SYMBOL_LEN = 56;
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

function seededRandom(seedStr) {
  let hash = 0xdeadbeef;
  for (let index = 0; index < seedStr.length; index += 1) {
    hash = Math.imul(hash ^ seedStr.charCodeAt(index), 2654435761);
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
      <filter id={`${prefix}-selected`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={COLORS.selected} floodOpacity="0.7" />
      </filter>
      <filter id={`${prefix}-equivalent`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={COLORS.equivalent} floodOpacity="0.65" />
      </filter>
      <pattern id={`${prefix}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#B8CBD5" strokeWidth="0.55" opacity="0.55" />
      </pattern>
      <pattern id={`${prefix}-grid-major`} width="120" height="120" patternUnits="userSpaceOnUse">
        <rect width="120" height="120" fill={`url(#${prefix}-grid)`} />
        <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#8FA9B7" strokeWidth="0.75" opacity="0.5" />
      </pattern>
    </defs>
  );
}

function ZigZagSymbol({ color }) {
  const halfLength = SYMBOL_LEN / 2;
  const amplitude = 9;
  const peaks = 6;
  const segmentWidth = SYMBOL_LEN / peaks;
  let points = `${-halfLength},0`;

  for (let index = 0; index < peaks; index += 1) {
    const xOffset = -halfLength + segmentWidth * index;
    const direction = index % 2 === 0 ? -1 : 1;
    points += ` ${xOffset + segmentWidth / 2},${direction * amplitude}`;
    points += ` ${xOffset + segmentWidth},0`;
  }

  return (
    <polyline
      points={points}
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

function PlatesSymbol({ color }) {
  const halfLength = SYMBOL_LEN / 2;
  const gap = 10;
  const plateHeight = 20;

  return (
    <g pointerEvents="none">
      <line x1={-halfLength} y1="0" x2={-gap / 2} y2="0" stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={-gap / 2} y1={-plateHeight / 2} x2={-gap / 2} y2={plateHeight / 2} stroke={color} strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={gap / 2} y1={-plateHeight / 2} x2={gap / 2} y2={plateHeight / 2} stroke={color} strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={gap / 2} y1="0" x2={halfLength} y2="0" stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function SwitchSymbol({ color, switchState }) {
  const isOpen = switchState === 'open';
  return (
    <g pointerEvents="none">
      <circle cx="-14" cy="0" r="3.5" fill="#FFFFFF" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx="14" cy="0" r="3.5" fill="#FFFFFF" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line
        x1="-14"
        y1="0"
        x2={isOpen ? 7 : 14}
        y2={isOpen ? -14 : 0}
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
    return `Interruptor ${edge.switchState === 'open' ? 'abierto' : 'cerrado'}, ${formatValue(edge.val, edge.compType)}`;
  }
  return `${edge.compType === 'R' ? 'Resistencia' : 'Capacitor'} ${edge.label}, ${formatValue(edge.val, edge.compType)}`;
}

function handleKeyboardSelect(event, edgeId, onClick) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    onClick(edgeId);
  }
}

function makeEdgeGeometry(edge, edges, x1, y1, x2, y2, isMessy) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 1) return null;

  const dx = (x2 - x1) / length;
  const dy = (y2 - y1) / length;
  let perpX = -dy;
  let perpY = dx;
  if (perpY > 0) {
    perpX *= -1;
    perpY *= -1;
  }

  const parallelEdges = edges
    .filter((candidate) => getParallelKey(candidate) === getParallelKey(edge))
    .toSorted((a, b) => a.id.localeCompare(b.id));
  const parallelIndex = parallelEdges.findIndex((candidate) => candidate.id === edge.id);
  const parallelOffset = parallelEdges.length > 1
    ? (parallelIndex - (parallelEdges.length - 1) / 2) * 38
    : 0;
  const messyOffset = isMessy ? seededRandom(`${edge.id}-edge-offset`) * 10 - 5 : 0;
  const offset = parallelOffset + messyOffset;

  const centerX = (x1 + x2) / 2 + perpX * offset;
  const centerY = (y1 + y2) / 2 + perpY * offset;
  const symbolHalf = Math.min(SYMBOL_LEN / 2, length * 0.22);
  const inset = Math.min(22, length * 0.15);
  const startX = x1 + dx * inset;
  const startY = y1 + dy * inset;
  const endX = x2 - dx * inset;
  const endY = y2 - dy * inset;
  const symbolStartX = centerX - dx * symbolHalf;
  const symbolStartY = centerY - dy * symbolHalf;
  const symbolEndX = centerX + dx * symbolHalf;
  const symbolEndY = centerY + dy * symbolHalf;

  const firstControlX = (startX + symbolStartX) / 2 + perpX * offset * 0.5;
  const firstControlY = (startY + symbolStartY) / 2 + perpY * offset * 0.5;
  const secondControlX = (symbolEndX + endX) / 2 + perpX * offset * 0.5;
  const secondControlY = (symbolEndY + endY) / 2 + perpY * offset * 0.5;
  const hitFirstPath = offset === 0
    ? `M ${startX} ${startY} L ${symbolStartX} ${symbolStartY}`
    : `M ${startX} ${startY} Q ${firstControlX} ${firstControlY} ${symbolStartX} ${symbolStartY}`;
  const hitSecondPath = offset === 0
    ? `M ${symbolEndX} ${symbolEndY} L ${endX} ${endY}`
    : `M ${symbolEndX} ${symbolEndY} Q ${secondControlX} ${secondControlY} ${endX} ${endY}`;
  const visibleFirstPath = offset === 0
    ? `M ${x1} ${y1} L ${symbolStartX} ${symbolStartY}`
    : `M ${x1} ${y1} Q ${(x1 + symbolStartX) / 2 + perpX * offset * 0.5} ${(y1 + symbolStartY) / 2 + perpY * offset * 0.5} ${symbolStartX} ${symbolStartY}`;
  const visibleSecondPath = offset === 0
    ? `M ${symbolEndX} ${symbolEndY} L ${x2} ${y2}`
    : `M ${symbolEndX} ${symbolEndY} Q ${(symbolEndX + x2) / 2 + perpX * offset * 0.5} ${(symbolEndY + y2) / 2 + perpY * offset * 0.5} ${x2} ${y2}`;
  const outwardSign = parallelOffset >= 0 ? 1 : -1;

  return {
    angle: Math.atan2(dy, dx) * (180 / Math.PI),
    centerX,
    centerY,
    hitFirstPath,
    hitSecondPath,
    visibleFirstPath,
    visibleSecondPath,
    labelX: centerX - perpX * 31,
    labelY: centerY - perpY * 31,
    valueX: centerX + perpX * 31,
    valueY: centerY + perpY * 31,
    parallelCount: parallelEdges.length,
    tagX: centerX + perpX * outwardSign * 31,
    tagY: centerY + perpY * outwardSign * 31,
  };
}

function EdgeComponent({ edge, edges, x1, y1, x2, y2, isSelected, onClick, isMessy, filterIds }) {
  const geometry = makeEdgeGeometry(edge, edges, x1, y1, x2, y2, isMessy);
  if (!geometry) return null;

  const isEquivalent = edge.label === 'Eq';
  const color = getSymbolColor(edge, isSelected, isEquivalent);
  const filter = isSelected
    ? `url(#${filterIds.selected})`
    : isEquivalent
      ? `url(#${filterIds.equivalent})`
      : undefined;

  return (
    <g
      className={`edge-component ${isSelected ? 'is-selected' : ''} ${isEquivalent ? 'is-equivalent edge-component--merge' : ''}`}
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
      <path d={geometry.hitFirstPath} fill="none" stroke="transparent" strokeWidth="34" strokeLinecap="round" pointerEvents="stroke" />
      <path d={geometry.hitSecondPath} fill="none" stroke="transparent" strokeWidth="34" strokeLinecap="round" pointerEvents="stroke" />
      <rect x={-34} y={-25} width="68" height="50" rx="18" fill="transparent" pointerEvents="all" transform={`translate(${geometry.centerX}, ${geometry.centerY}) rotate(${geometry.angle})`} />

      <path d={geometry.visibleFirstPath} fill="none" stroke={COLORS.wire} strokeWidth="2.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <path d={geometry.visibleSecondPath} fill="none" stroke={COLORS.wire} strokeWidth="2.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <g transform={`translate(${geometry.centerX}, ${geometry.centerY}) rotate(${geometry.angle})`} pointerEvents="none">
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
        <g transform={`translate(${geometry.tagX}, ${geometry.tagY})`} pointerEvents="none">
          <rect
            x={-Math.max(30, Math.min(76, 8 + (edge.label.length + formatValue(edge.val, edge.compType).length) * 2.8))}
            y="-11"
            width={Math.max(60, Math.min(152, 16 + (edge.label.length + formatValue(edge.val, edge.compType).length) * 5.6))}
            height="22"
            rx="8"
            fill="#FFFFFF"
            fillOpacity="0.86"
            stroke="#D1E0E7"
            strokeWidth="0.8"
          />
          <text textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="700" fill={isSelected ? '#168F82' : COLORS.ink} fontFamily="'IBM Plex Mono', monospace">
            {edge.label} · {formatValue(edge.val, edge.compType)}
          </text>
        </g>
      ) : (
        <>
          <text x={geometry.labelX} y={geometry.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill={COLORS.ink} fontFamily="'Space Grotesk', sans-serif" pointerEvents="none">
            {edge.label}
          </text>
          <text x={geometry.valueX} y={geometry.valueY} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="600" fill={isSelected ? '#168F82' : '#60788B'} fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">
            {formatValue(edge.val, edge.compType)}
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

function getLayout(nodes) {
  if (nodes.length === 0) {
    return { positions: {}, width: 520, height: 420 };
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const positions = Object.fromEntries(nodes.map((node) => [
    node.id,
    {
      px: PADDING + (node.x - minX) * GRID_SPACING_X,
      py: PADDING + (node.y - minY) * GRID_SPACING_Y,
    },
  ]));

  return {
    positions,
    width: Math.max(520, PADDING * 2 + (maxX - minX) * GRID_SPACING_X),
    height: Math.max(420, PADDING * 2 + (maxY - minY) * GRID_SPACING_Y),
  };
}

export default function GridCircuitSVG({ nodes, edges, selectedIds, onSelect, isMessy }) {
  const generatedId = useId();
  const prefix = `advanced-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const layout = useMemo(() => getLayout(nodes), [nodes]);
  const filterIds = {
    selected: `${prefix}-selected`,
    equivalent: `${prefix}-equivalent`,
  };

  return (
    <div className="circuit-scroll">
      <svg
        className="circuit-svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ minWidth: `${Math.max(560, Math.min(layout.width, 1180))}px` }}
        role="group"
        aria-label="Circuito avanzado interactivo"
        onClick={() => onSelect(null)}
      >
        <SvgDefs prefix={prefix} />
        <rect width={layout.width} height={layout.height} fill={`url(#${prefix}-grid-major)`} pointerEvents="all" />

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
              filterIds={filterIds}
            />
          );
        })}

        {nodes.map((node) => {
          const position = layout.positions[node.id];
          if (!position) return null;
          return <NodeDot key={node.id} node={node} px={position.px} py={position.py} />;
        })}
      </svg>
    </div>
  );
}

import React, { useId, useMemo } from 'react';
import { formatValue } from '../lib/circuit';

const COMP_W = 78;
const COMP_H = 44;
const WIRE_EXT = 24;
const BRANCH_GAP = 36;
const COLORS = {
  wire: '#526B80',
  ink: '#183047',
  selected: '#37D6C0',
  equivalent: '#FFB454',
  resistor: '#D98C42',
  capacitor: '#2AA9B8',
  cable: '#68849A',
};

function seededRandom(seed) {
  let hash = 0xdeadbeef;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 2654435761);
  }
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function getSymbolColor({ compType, isSelected, isEquivalent }) {
  if (isSelected) return COLORS.selected;
  if (isEquivalent) return COLORS.equivalent;
  if (compType === 'C') return COLORS.capacitor;
  if (compType === 'R') return COLORS.resistor;
  return COLORS.cable;
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

function ResistorSymbol({ w, h, color }) {
  const wireLength = 12;
  const zigzagWidth = w - wireLength * 2;
  const centerY = h / 2;
  const amplitude = 6;
  const peaks = 5;
  const segmentWidth = zigzagWidth / peaks;
  let points = '0,' + centerY + ' ' + wireLength + ',' + centerY;

  for (let index = 0; index < peaks; index += 1) {
    const xOffset = wireLength + segmentWidth * index;
    const direction = index % 2 === 0 ? -1 : 1;
    points += ' ' + (xOffset + segmentWidth / 2) + ',' + (centerY + direction * amplitude);
    points += ' ' + (xOffset + segmentWidth) + ',' + centerY;
  }
  points += ' ' + w + ',' + centerY;

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

function CapacitorSymbol({ w, h, color }) {
  const centerY = h / 2;
  const plateHeight = 17;
  const gap = 8;
  const centerX = w / 2;

  return (
    <g pointerEvents="none">
      <line x1="0" y1={centerY} x2={centerX - gap / 2} y2={centerY} stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={centerX - gap / 2} y1={centerY - plateHeight / 2} x2={centerX - gap / 2} y2={centerY + plateHeight / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={centerX + gap / 2} y1={centerY - plateHeight / 2} x2={centerX + gap / 2} y2={centerY + plateHeight / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={centerX + gap / 2} y1={centerY} x2={w} y2={centerY} stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

function measureTree(node, isMessy) {
  if (node.type === 'leaf') {
    return { ...node, w: COMP_W, h: COMP_H };
  }

  const children = node.children.map((child) => measureTree(child, isMessy));
  const gaps = children.slice(0, -1).map((child, index) => {
    const suffix = child.id + '-' + index;
    if (node.type === 'parallel') {
      return isMessy ? seededRandom(suffix + '-parallel-gap') * 18 + BRANCH_GAP : BRANCH_GAP;
    }
    return isMessy ? seededRandom(suffix + '-series-gap') * 18 + 34 : 40;
  });
  const totalGaps = gaps.reduce((sum, gap) => sum + gap, 0);

  if (node.type === 'series') {
    return {
      ...node,
      w: children.reduce((sum, child) => sum + child.w, 0) + totalGaps,
      h: Math.max(...children.map((child) => child.h)) + (isMessy ? 32 : 0),
      children,
      gaps,
    };
  }

  return {
    ...node,
    w: Math.max(...children.map((child) => child.w)) + WIRE_EXT * 2 + (isMessy ? 32 : 0),
    h: children.reduce((sum, child) => sum + child.h, 0) + totalGaps + (isMessy ? 26 : 0),
    children,
    gaps,
  };
}

function Wire({ x1, y1, x2, y2, isMessy, seed, color = COLORS.wire, showFlow = false, flowReverse = false }) {
  const flowClassName = 'flow-trace' + (flowReverse ? ' flow-trace--reverse' : '');

  if (isMessy && seed) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const controlX = midX + seededRandom(seed + '-x') * 12 - 6;
    const controlY = midY + seededRandom(seed + '-y') * 12 - 6;
    const d = 'M ' + x1 + ' ' + y1 + ' Q ' + controlX + ' ' + controlY + ' ' + x2 + ' ' + y2;
    return (
      <g pointerEvents="none">
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {showFlow && <path className={flowClassName} d={d} fill="none" vectorEffect="non-scaling-stroke" />}
      </g>
    );
  }

  return (
    <g pointerEvents="none">
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {showFlow && <line className={flowClassName} x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />}
    </g>
  );
}

function PositiveFlow({ width, centerY, batteryY, circuitRight }) {
  return (
    <path
      className="flow-trace flow-trace--positive"
      d={'M ' + (width / 2 + 18) + ' ' + batteryY + ' L ' + (width - 36) + ' ' + batteryY + ' L ' + (width - 36) + ' ' + centerY + ' L ' + circuitRight + ' ' + centerY}
      fill="none"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

function ReturnFlow({ centerY, batteryY, circuitLeft }) {
  return (
    <path
      className="flow-trace"
      d={'M ' + circuitLeft + ' ' + centerY + ' L 36 ' + centerY + ' L 36 ' + batteryY}
      fill="none"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

function JunctionDot({ x, y, tone = COLORS.ink }) {
  return <circle cx={x} cy={y} r="4.5" fill={tone} pointerEvents="none" />;
}

function getNodeLabel(node) {
  if (node.compType === 'W') return 'Cable, cortocircuito';
  return (node.compType === 'R' ? 'Resistencia ' : 'Capacitor ')
    + node.label + ', ' + formatValue(node.val, node.compType);
}

function handleKeyboardSelect(event, nodeId, onSelect) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    onSelect(nodeId);
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

  if (closest && closest.distance <= 28) {
    onSelect(closest.id);
    return;
  }

  onSelect(null);
}

function RenderNode({ node, x, y, selectedIds, onSelect, isMessy, showFlow, filterIds }) {
  if (node.type === 'leaf') {
    const isSelected = selectedIds.includes(node.id);
    const isEquivalent = node.label === 'Eq';
    const color = getSymbolColor({ compType: node.compType, isSelected, isEquivalent });
    const filter = isSelected
      ? 'url(#' + filterIds.selected + ')'
      : isEquivalent
        ? 'url(#' + filterIds.equivalent + ')'
        : undefined;

    return (
      <g
        data-component-id={node.id}
        transform={'translate(' + x + ', ' + y + ')'}
        className={'circuit-component ' + (isSelected ? 'is-selected ' : '') + (isEquivalent ? 'is-equivalent' : '')}
        role="button"
        tabIndex="0"
        aria-label={getNodeLabel(node)}
        aria-pressed={isSelected}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onKeyDown={(event) => handleKeyboardSelect(event, node.id, onSelect)}
        filter={filter}
      >
        <g className={isEquivalent ? 'circuit-component--merge' : undefined}>
          <rect
            x="-12"
            y="-16"
            width={node.w + 24}
            height={node.h + 34}
            rx="13"
            fill="transparent"
            data-component-hitbox="true"
            pointerEvents="none"
          />
          <rect
            x="0"
            y="0"
            width={node.w}
            height={node.h}
            rx="13"
            fill={isSelected ? '#E3FBF6' : isEquivalent ? '#FFF4DF' : '#FFFFFF'}
            fillOpacity="0.94"
            stroke={isSelected ? COLORS.selected : isEquivalent ? COLORS.equivalent : '#B9CBD5'}
            strokeWidth={isSelected || isEquivalent ? '1.8' : '1'}
            pointerEvents="none"
          />
          <rect x="-3" y="-3" width={node.w + 6} height={node.h + 6} rx="16" fill="none" stroke={color} strokeWidth="1.4" opacity={isSelected || isEquivalent ? 0.45 : 0} pointerEvents="none" />
          {node.compType === 'W' ? (
            <line x1="0" y1={node.h / 2} x2={node.w} y2={node.h / 2} stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          ) : node.compType === 'R' ? (
            <ResistorSymbol w={node.w} h={node.h} color={color} />
          ) : (
            <CapacitorSymbol w={node.w} h={node.h} color={color} />
          )}
          <text x={node.w / 2} y="-9" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={COLORS.ink} fontFamily="'Space Grotesk', sans-serif" pointerEvents="none">
            {node.label}
          </text>
          <text x={node.w / 2} y={node.h + 15} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={isSelected ? '#168F82' : '#60788B'} fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">
            {formatValue(node.val, node.compType)}
          </text>
        </g>
      </g>
    );
  }

  if (node.type === 'series') {
    const centerY = y + node.h / 2;
    const positionedChildren = node.children.reduce((items, child, index) => {
      const previous = items[items.length - 1];
      const childX = previous ? previous.childX + previous.child.w + previous.gapAfter : x;
      const childY = centerY - child.h / 2;
      const childPortY = childY + child.h / 2;

      return [...items, {
        child,
        childX,
        childY,
        childPortY,
        previousPortY: previous ? previous.childPortY : centerY,
        gapBefore: node.gaps[index - 1] || 0,
        gapAfter: node.gaps[index] || 0,
      }];
    }, []);

    return (
      <g>
        {positionedChildren.map(({ child, childX, childY, childPortY, previousPortY, gapBefore }, index) => (
          <React.Fragment key={child.id}>
            {index > 0 && (
              <Wire
                x1={childX - gapBefore}
                y1={previousPortY}
                x2={childX}
                y2={childPortY}
                isMessy={isMessy}
                seed={child.id + '-series-wire'}
                showFlow={showFlow}
                flowReverse
              />
            )}
            <RenderNode
              node={child}
              x={childX}
              y={childY}
              selectedIds={selectedIds}
              onSelect={onSelect}
              isMessy={isMessy}
              showFlow={showFlow}
              filterIds={filterIds}
            />
          </React.Fragment>
        ))}
      </g>
    );
  }

  if (node.type === 'parallel') {
    const centerX = x + node.w / 2;
    const positionedChildren = node.children.reduce((items, child, index) => {
      const previous = items[items.length - 1];
      const childY = previous ? previous.childY + previous.child.h + previous.gapAfter : y;
      const offsetX = isMessy ? seededRandom(child.id + '-parallel-offset') * 14 - 7 : 0;
      const childX = centerX - child.w / 2 + offsetX;
      const childPortY = childY + child.h / 2;

      return [...items, {
        child,
        childX,
        childY,
        childPortY,
        gapAfter: node.gaps[index] || 0,
      }];
    }, []);
    const connectionYs = positionedChildren.map((item) => item.childPortY);

    return (
      <g>
        <Wire x1={x} y1={connectionYs[0]} x2={x} y2={connectionYs[connectionYs.length - 1]} isMessy={isMessy} seed={node.id + '-parallel-bus-left'} />
        <Wire x1={x + node.w} y1={connectionYs[0]} x2={x + node.w} y2={connectionYs[connectionYs.length - 1]} isMessy={isMessy} seed={node.id + '-parallel-bus-right'} />
        {connectionYs.map((connectionY, index) => (
          <React.Fragment key={node.id + '-junction-' + index}>
            <JunctionDot x={x} y={connectionY} />
            <JunctionDot x={x + node.w} y={connectionY} />
          </React.Fragment>
        ))}
        {positionedChildren.map(({ child, childX, childY, childPortY }) => (
          <React.Fragment key={child.id}>
            <Wire x1={x} y1={childPortY} x2={childX} y2={childPortY} isMessy={isMessy} seed={child.id + '-parallel-left'} showFlow={showFlow} flowReverse />
            <Wire x1={childX + child.w} y1={childPortY} x2={x + node.w} y2={childPortY} isMessy={isMessy} seed={child.id + '-parallel-right'} showFlow={showFlow} flowReverse />
            <RenderNode
              node={child}
              x={childX}
              y={childY}
              selectedIds={selectedIds}
              onSelect={onSelect}
              isMessy={isMessy}
              showFlow={showFlow}
              filterIds={filterIds}
            />
          </React.Fragment>
        ))}
      </g>
    );
  }

  return null;
}

function BatterySymbol({ x, y }) {
  return (
    <g transform={'translate(' + x + ', ' + y + ')'} pointerEvents="none">
      <line x1="-8" y1="-15" x2="-8" y2="15" stroke="#39546A" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1="8" y1="-25" x2="8" y2="25" stroke="#183047" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <text x="-24" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="#39546A" fontFamily="'Space Grotesk', sans-serif">−</text>
      <text x="25" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="#D98C42" fontFamily="'Space Grotesk', sans-serif">+</text>
      <text x="0" y="42" textAnchor="middle" fontSize="12" fontWeight="700" fill="#60788B" fontFamily="'IBM Plex Mono', monospace">FUENTE · 12 V</text>
    </g>
  );
}

export default function CircuitSVG({ tree, selectedIds, onSelect, isMessy, showFlow = false }) {
  const generatedId = useId();
  const prefix = 'basic-' + generatedId.replace(/[^a-zA-Z0-9_-]/g, '');
  const measured = useMemo(() => measureTree(tree, isMessy), [isMessy, tree]);
  const padding = 74;
  const width = measured.w + padding * 2;
  const height = measured.h + padding * 2 + 76;
  const centerY = padding + measured.h / 2;
  const batteryY = height - 48;
  const filterIds = {
    selected: prefix + '-selected',
    equivalent: prefix + '-equivalent',
  };

  return (
    <div className="circuit-scroll circuit-scroll--fit">
      <svg
        className="circuit-svg"
        width={width}
        height={height}
        viewBox={'0 0 ' + width + ' ' + height}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Circuito básico interactivo"
        onClick={(event) => handleCircuitCanvasClick(event, onSelect)}
      >
        <SvgDefs prefix={prefix} />
        <rect width={width} height={height} fill={'url(#' + prefix + '-grid-major)'} pointerEvents="all" />
        <g className="source-decoration" pointerEvents="none">
          <Wire x1="36" y1={centerY} x2={padding} y2={centerY} isMessy={false} />
          <Wire x1={padding + measured.w} y1={centerY} x2={width - 36} y2={centerY} isMessy={false} />
          <Wire x1="36" y1={centerY} x2="36" y2={batteryY} isMessy={false} />
          <Wire x1={width - 36} y1={centerY} x2={width - 36} y2={batteryY} isMessy={false} />
          <Wire x1="36" y1={batteryY} x2={width / 2 - 18} y2={batteryY} isMessy={false} />
          <Wire x1={width - 36} y1={batteryY} x2={width / 2 + 18} y2={batteryY} isMessy={false} />
          <JunctionDot x="36" y={centerY} />
          <JunctionDot x={width - 36} y={centerY} />
          <JunctionDot x="36" y={batteryY} />
          <JunctionDot x={width - 36} y={batteryY} />
          <BatterySymbol x={width / 2} y={batteryY} />
          {showFlow && <PositiveFlow width={width} centerY={centerY} batteryY={batteryY} circuitRight={padding + measured.w} />}
          {showFlow && <ReturnFlow centerY={centerY} batteryY={batteryY} circuitLeft={padding} />}
        </g>
        <RenderNode
          node={measured}
          x={padding}
          y={centerY - measured.h / 2}
          selectedIds={selectedIds}
          onSelect={onSelect}
          isMessy={isMessy}
          showFlow={showFlow}
          filterIds={filterIds}
        />
      </svg>
    </div>
  );
}

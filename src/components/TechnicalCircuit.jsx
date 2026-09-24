import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { drawingGeometry, nodePorts, pointsToPath } from '../lib/technicalDrawing.js';
import { makeEdgeGeometry } from '../lib/svgGeometry.js';
import { formatExact } from '../lib/values.js';

function Symbol({ edge, style }) {
  if (edge.compType === 'W') return <path d="M -19 0 H 19" />;
  if (edge.compType === 'S') return <><circle cx="-16" cy="0" r="2.5" /><circle cx="16" cy="0" r="2.5" /><path d={edge.switchState === 'open' ? 'M -14 0 L 12 -13' : 'M -14 0 L 14 0'} /></>;
  if (edge.compType === 'C') return <path d="M -19 0 H -5 M -5 -12 V 12 M 5 -12 V 12 M 5 0 H 19" />;
  return style === 'rectangle' ? <><path d="M -19 0 H -16 M 16 0 H 19" /><rect x="-16" y="-7" width="32" height="14" /></> : <path d="M -19 0 L -15 -7 L -9 7 L -3 -7 L 3 7 L 9 -7 L 15 7 L 19 0" />;
}
const names = { R: 'Resistencia', C: 'Capacitor', W: 'Cable', S: 'Interruptor' };
function TechnicalCircuit({ exercise, settings, selected, onSelect, onClear, disabled = false }) {
  const svgRef = useRef(null), gesture = useRef({ pointers: new Map() });
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 }), [pixelScale, setPixelScale] = useState(1), [candidates, setCandidates] = useState([]);
  const drawing = useMemo(() => drawingGeometry(exercise), [exercise]);
  const battery = useMemo(() => makeEdgeGeometry(exercise.sourceRoute), [exercise.sourceRoute]);
  const scale = pixelScale * zoom;
  const flow = settings.flow && settings.compType === 'R' && exercise.edges.every(edge => edge.compType === 'R');
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setPixelScale(Math.min(rect.width / exercise.bounds.width, rect.height / exercise.bounds.height));
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [exercise.bounds.width, exercise.bounds.height]);
  const magnify = value => { setZoom(Math.max(1, Math.min(4, value))); if (value <= 1) setPan({ x: 0, y: 0 }); };
  function choose(event, forcedId) {
    if (disabled || gesture.current.moved) return;
    if (event.detail === 0 && forcedId) { onSelect(forcedId); return; }
    const matrix = svgRef.current.getScreenCTM();
    const nearby = drawing.geometries.filter(g => {
      const p = new DOMPoint(g.centerX, g.centerY).matrixTransform(matrix);
      return Math.hypot(p.x - event.clientX, p.y - event.clientY) < (event.pointerType === 'touch' ? 36 : 24);
    });
    if (nearby.length > 1) { setCandidates(nearby.map(g => g.edge)); return; }
    if (nearby.length === 1) onSelect(nearby[0].edge.id);
    else if (forcedId) onSelect(forcedId);
    else onClear();
  }
  function pointerDown(event) {
    gesture.current.moved = false;
    if (zoom <= 1) return;
    svgRef.current.setPointerCapture(event.pointerId);
    gesture.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current.distance = null;
  }
  function pointerMove(event) {
    const g = gesture.current, old = g.pointers.get(event.pointerId);
    if (!old || zoom <= 1) return;
    const dx = event.clientX - old.x, dy = event.clientY - old.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
    g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.distance) magnify(zoom * distance / g.distance);
      g.distance = distance;
    } else setPan(previous => ({ x: Math.max(-exercise.bounds.width / 2, Math.min(exercise.bounds.width / 2, previous.x - dx / scale)), y: Math.max(-exercise.bounds.height / 2, Math.min(exercise.bounds.height / 2, previous.y - dy / scale)) }));
  }
  return <div className={`drawing-area ${zoom > 1 ? 'is-zoomed' : ''}`}>
    <div className="view-tools" aria-label="Vista del circuito"><button onClick={() => magnify(zoom - .5)} aria-label="Alejar circuito" disabled={zoom === 1}>−</button><button onClick={() => magnify(1)}>Ajustar</button><button onClick={() => magnify(zoom + .5)} aria-label="Acercar circuito" disabled={zoom === 4}>+</button><span>{Math.round(zoom * 100)}%</span></div>
    <svg ref={svgRef} className="technical-circuit" role="group" aria-label="Circuito eléctrico interactivo" data-testid="circuit" viewBox={`${(exercise.bounds.width - exercise.bounds.width / zoom) / 2 + pan.x} ${(exercise.bounds.height - exercise.bounds.height / zoom) / 2 + pan.y} ${exercise.bounds.width / zoom} ${exercise.bounds.height / zoom}`} onClick={event => choose(event)} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => gesture.current.pointers.delete(event.pointerId)} onPointerCancel={event => gesture.current.pointers.delete(event.pointerId)}>
      <g className="conductors" aria-hidden="true">{drawing.buses.map(bus => <path key={bus.id} d={pointsToPath(bus.route)} />)}<path d={battery.visibleFirstPath} /><path d={battery.visibleSecondPath} />{drawing.geometries.map(g => <g key={g.edge.id}><path d={g.visibleFirstPath} /><path d={g.visibleSecondPath} /></g>)}</g>
      {flow && <g className="current-flow" aria-hidden="true"><path className="return-flow" d={battery.visibleFirstPath} /><path className="return-flow" d={battery.visibleSecondPath} />{drawing.geometries.map(g => <g key={g.edge.id}><path d={g.visibleFirstPath} /><path d={g.visibleSecondPath} /></g>)}</g>}
      <g aria-hidden="true" className="junctions">{exercise.nodes.flatMap(node => nodePorts(exercise, node.id).filter((p, i, arr) => arr.findIndex(q => q.x === p.x && q.y === p.y) === i).map((p, i) => <circle key={`${node.id}-${i}`} cx={p.x} cy={p.y} r="3" />))}</g>
      <g className="battery-symbol" aria-label="Fuente activa: 12 voltios" transform={`translate(${battery.centerX} ${battery.centerY}) rotate(${battery.angle})`}><path d="M -19 0 H -5 M -5 -17 V 17 M 5 -9 V 9 M 5 0 H 19" /><text x="-24" y="-16">+</text><text x="18" y="-16">−</text><text className="source-caption" x="0" y="37" textAnchor="middle">12 V</text></g>
      {drawing.geometries.map(g => <g key={g.edge.id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-pressed={selected.includes(g.edge.id)} aria-label={`${names[g.edge.compType]} ${g.edge.label}, ${formatExact(g.edge.value, settings)}`} data-component-id={g.edge.id} data-component-type={g.edge.compType} data-from={g.edge.from} data-to={g.edge.to} className={`circuit-component ${selected.includes(g.edge.id) ? 'selected' : ''} ${g.edge.equivalent ? 'equivalent' : ''} ${g.edge.switchState === 'open' ? 'open-switch' : ''}`} onClick={event => { event.stopPropagation(); choose(event, g.edge.id); }} onKeyDown={event => { if (['Enter', ' '].includes(event.key) && !event.repeat) { event.preventDefault(); if (!disabled) onSelect(g.edge.id); } }}>
        <g transform={`translate(${g.centerX} ${g.centerY}) rotate(${g.angle})`}><rect className="component-hitbox" data-component-hitbox="true" pointerEvents="all" x={-Math.max(64, 44 / Math.max(scale, .1)) / 2} y={-Math.max(44, 44 / Math.max(scale, .1)) / 2} width={Math.max(64, 44 / Math.max(scale, .1))} height={Math.max(44, 44 / Math.max(scale, .1))} rx="6" /><g className="electrical-symbol" transform={`scale(${g.symbolScale})`}><Symbol edge={g.edge} style={settings.resistorStyle} /></g></g>
        {g.labelBox && <g className="component-label" pointerEvents="none"><text x={g.labelBox.x + g.labelBox.w / 2} y={g.labelBox.y + 13} textAnchor="middle" className="component-id" style={{ fontSize: Math.max(14, Math.min(32, 11 / Math.max(scale, .1))) }}>{g.edge.label}</text><text x={g.labelBox.x + g.labelBox.w / 2} y={g.labelBox.y + 30} textAnchor="middle" className="component-value">{formatExact(g.edge.value, settings, true)}</text></g>}
      </g>)}
    </svg>
    {candidates.length > 0 && <div className="candidate-picker" role="group" aria-label="Componentes cercanos"><p>Hay varios componentes cerca. ¿Cuál querés seleccionar?</p>{candidates.map(edge => <button key={edge.id} onClick={() => { onSelect(edge.id); setCandidates([]); }}>{edge.label} · {formatExact(edge.value, settings)}</button>)}<button onClick={() => setCandidates([])}>Cancelar</button></div>}
    <div className="drawing-caption">{zoom > 1 ? 'Arrastrá para moverte · Ajustar recupera la vista completa' : 'Seleccioná en el dibujo o en la lista de componentes'}{flow && <span>Flujo ilustrativo, no a escala</span>}</div>
  </div>;
}
export default memo(TechnicalCircuit);

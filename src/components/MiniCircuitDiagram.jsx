import { formatExact } from '../lib/values.js';

function Element({ edge, x, y, settings, muted = false }) {
  const capacitor = edge.compType === 'C';
  return <g className={`mini-element ${muted ? 'is-muted' : 'is-target'}`} aria-label={`${edge.label}, ${formatExact(edge.value, settings)}`}>
    {capacitor
      ? <><path d={`M ${x - 42} ${y} H ${x - 8} M ${x + 8} ${y} H ${x + 42}`} /><path d={`M ${x - 8} ${y - 16} V ${y + 16} M ${x + 8} ${y - 16} V ${y + 16}`} /></>
      : <path d={`M ${x - 42} ${y} H ${x - 25} L ${x - 17} ${y - 11} L ${x - 7} ${y + 11} L ${x + 3} ${y - 11} L ${x + 13} ${y + 11} L ${x + 23} ${y - 11} L ${x + 25} ${y} H ${x + 42}`} />}
    <text x={x} y={y - 23} textAnchor="middle" className="mini-label">{edge.label}</text>
    <text x={x} y={y + 31} textAnchor="middle" className="mini-value">{formatExact(edge.value, settings, true)}</text>
  </g>;
}

export default function MiniCircuitDiagram({ mini }) {
  const kind = mini.layout;
  const edges = new Map(mini.edges.map(edge => [edge.id, edge]));
  const frame = <>
    <g className="mini-wires">
      {kind === 'parallel' ? <>
        <path d="M 60 75 V 165 M 300 75 V 165 M 60 75 H 138 M 222 75 H 300 M 60 165 H 138 M 222 165 H 300" />
        <path d="M 60 120 V 270 H 151 M 209 270 H 300 V 120" />
      </> : kind === 'branched-series' ? <>
        <path d="M 142 105 H 198 M 282 105 H 300 M 60 105 V 270 H 151 M 209 270 H 300 V 105" />
        <path d="M 180 105 V 205 H 198 M 282 205 H 300" />
      </> : <>
        <path d="M 60 120 H 78 M 162 120 H 198 M 282 120 H 300 M 60 120 V 270 H 151 M 209 270 H 300 V 120" />
      </>}
      <path d="M 168 257 V 283 M 192 263 V 277" className="mini-battery" />
      <text x="156" y="253" className="mini-polarity">+</text><text x="198" y="253" className="mini-polarity">−</text>
      <text x="180" y="302" textAnchor="middle" className="mini-source">Fuente ideal · 12 V</text>
    </g>
    {kind === 'series' && <>
      <Element edge={edges.get('m1')} x={120} y={120} settings={mini.settings} />
      <Element edge={edges.get('m2')} x={240} y={120} settings={mini.settings} />
    </>}
    {kind === 'parallel' && <>
      <Element edge={edges.get('m1')} x={180} y={75} settings={mini.settings} />
      <Element edge={edges.get('m2')} x={180} y={165} settings={mini.settings} />
    </>}
    {kind === 'branched-series' && <>
      <Element edge={edges.get('m1')} x={100} y={105} settings={mini.settings} />
      <Element edge={edges.get('m2')} x={240} y={105} settings={mini.settings} />
      <Element edge={edges.get('m3')} x={240} y={205} settings={mini.settings} muted />
    </>}
    <g className="mini-nodes"><circle cx="60" cy={kind === 'parallel' ? '75' : '120'} r="4" /><circle cx="300" cy={kind === 'parallel' ? '75' : '120'} r="4" />{kind !== 'parallel' && <circle cx="180" cy={kind === 'branched-series' ? '105' : '120'} r="4" />}</g>
    <text x="48" y="53" className="mini-terminal">A</text><text x="303" y="53" className="mini-terminal">B</text>
  </>;
  return <svg className="mini-circuit" viewBox="0 0 360 320" role="img" aria-label="Diagrama de práctica con componentes marcados y fuente ideal">{frame}</svg>;
}

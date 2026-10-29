export default function InductorSymbol({ style = 'schematic' }) {
  if (style === 'copper') return <g className="inductor-coil-copper">
    <path className="inductor-core" d="M -17 0 H 17" />
    {[-13.5, -4.5, 4.5, 13.5].map(x => <g key={x}>
      <ellipse cx={x} cy="0" rx="4.5" ry="10" />
      <path className="inductor-highlight" d={`M ${x - 2} -7 Q ${x - 4} 0 ${x - 2} 7`} />
    </g>)}
    <path d="M -19 0 H -18 M 18 0 H 19" />
  </g>;
  return <path d="M -19 0 H -18.5 A 4.5 10 0 0 1 -9.5 0 A 4.5 10 0 0 1 -0.5 0 A 4.5 10 0 0 1 8.5 0 A 4.5 10 0 0 1 17.5 0 H 19" />;
}

import React, { useState } from 'react';
import { Maximize, Scan } from 'lucide-react';

export default function CircuitViewport({ children, className = '', ...metadata }) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className={'circuit-viewport ' + className} {...metadata}>
      <div className="circuit-viewport__tools" aria-label="Zoom del circuito">
        <button
          type="button"
          className="circuit-zoom-button"
          aria-pressed={zoomed}
          onClick={() => setZoomed((current) => !current)}
        >
          {zoomed ? <Scan size={15} /> : <Maximize size={15} />}
          {zoomed ? 'Ajustar' : 'Ampliar'}
        </button>
      </div>
      <div className={'circuit-scroll circuit-scroll--fit' + (zoomed ? ' is-zoomed' : '')}>
        {children}
      </div>
    </div>
  );
}

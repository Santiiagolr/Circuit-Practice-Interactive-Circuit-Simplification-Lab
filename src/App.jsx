import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Grid3X3,
  Layers,
  Lightbulb,
  RefreshCw,
  Shuffle,
  Spline,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  combineNodes,
  formatValue,
  generateRandomCircuit,
  relabelTree,
  validateSelection,
} from './lib/circuit';
import {
  combineGraphEdges,
  deleteGraphEdge,
  formatValue as gFormatValue,
  generateGridCircuit,
  validateGraphSelection,
} from './lib/graphCircuit';
import CircuitSVG from './components/CircuitSVG';
import GridCircuitSVG from './components/GridCircuitSVG';

function FormulaPanel({ compType }) {
  const formulas = compType === 'R'
    ? {
        series: <>R<sub>eq</sub> = R<sub>1</sub> + R<sub>2</sub> + R<sub>3</sub> + …</>,
        parallel: <>1/R<sub>eq</sub> = 1/R<sub>1</sub> + 1/R<sub>2</sub> + …</>,
        name: 'Resistencias',
      }
    : {
        series: <>1/C<sub>eq</sub> = 1/C<sub>1</sub> + 1/C<sub>2</sub> + …</>,
        parallel: <>C<sub>eq</sub> = C<sub>1</sub> + C<sub>2</sub> + C<sub>3</sub> + …</>,
        name: 'Capacitores',
      };

  return (
    <aside className="formula-rail" aria-label="Fórmulas de referencia">
      <div className="rail-heading">
        <div className="rail-icon"><BookOpen size={16} /></div>
        <div>
          <span className="eyebrow">Cuaderno de laboratorio</span>
          <h2>Reglas para {formulas.name.toLowerCase()}</h2>
        </div>
      </div>

      <div className="formula-rule formula-rule--series">
        <div className="formula-rule__label"><span className="formula-dot" /> Serie</div>
        <div className="formula-expression">{formulas.series}</div>
        <p>La misma corriente atraviesa cada componente.</p>
      </div>

      <div className="formula-rule formula-rule--parallel">
        <div className="formula-rule__label"><span className="formula-dot" /> Paralelo</div>
        <div className="formula-expression">{formulas.parallel}</div>
        <p>Todos comparten los mismos dos nodos.</p>
      </div>

      <div className="formula-note">
        <Lightbulb size={16} />
        <span>Primero identifica la conexión. Después elige la regla.</span>
      </div>
    </aside>
  );
}

const confettiPieces = Array.from({ length: 24 }, (_, index) => ({
  left: `${(index * 37) % 101}%`,
  top: `${(index * 19) % 38}%`,
  delay: `${(index % 7) * 0.08}s`,
  duration: `${1.2 + (index % 5) * 0.16}s`,
  size: `${6 + (index % 4) * 2}px`,
  shape: index % 3 === 0 ? '50%' : '3px',
  color: ['#37D6C0', '#FFB454', '#78A8FF', '#EF7770'][index % 4],
}));

function VictoryOverlay({ eqVal, compType, steps, onNext }) {
  const value = compType === 'R' ? formatValue(eqVal, compType) : gFormatValue(eqVal, compType);

  return (
    <div className="victory-overlay" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div className="confetti-field" aria-hidden="true">
        {confettiPieces.map((piece, index) => (
          <span
            key={index}
            className="confetti-piece"
            style={{
              left: piece.left,
              top: piece.top,
              width: piece.size,
              height: piece.size,
              borderRadius: piece.shape,
              backgroundColor: piece.color,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
            }}
          />
        ))}
      </div>

      <div className="victory-card">
        <div className="victory-mark"><Trophy size={28} /></div>
        <span className="eyebrow">Medición final</span>
        <h2 id="victory-title">Circuito reducido</h2>
        <p>Encontraste el componente equivalente en {steps} paso{steps === 1 ? '' : 's'}.</p>
        <div className="equivalent-readout">
          <span>{compType === 'R' ? 'Resistencia' : 'Capacitancia'} equivalente</span>
          <strong>{value}</strong>
        </div>
        <button className="button button--primary button--large" onClick={onNext}>
          Medir otro circuito <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function FeedbackBanner({ feedback, mode }) {
  const isError = feedback?.type === 'error';
  const isSuccess = feedback?.type === 'success';
  const message = feedback?.text || (mode === 'basic'
    ? 'Selecciona componentes que estén directamente conectados y elige una regla.'
    : 'Toca o enfoca los componentes para seleccionarlos. Luego elige una regla.');

  return (
    <div
      className={`feedback-banner ${isError ? 'feedback-banner--error' : ''} ${isSuccess ? 'feedback-banner--success' : ''}`}
      key={feedback?.key || 'idle'}
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span className="feedback-icon">
        {isError ? <XCircle size={18} /> : isSuccess ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}
      </span>
      <span>{message}</span>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState('basic');
  const [compType, setCompType] = useState('R');
  const [isMessy, setIsMessy] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [valueMode, setValueMode] = useState('varied');
  const [tree, setTree] = useState(() => relabelTree(generateRandomCircuit('R', 0, 3), 'R'));
  const [graphNodes, setGraphNodes] = useState([]);
  const [graphEdges, setGraphEdges] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [steps, setSteps] = useState(0);
  const [feedbackKey, setFeedbackKey] = useState(0);

  const initCircuit = useCallback((targetMode = mode, targetType = compType, targetValueMode = valueMode) => {
    setSelectedIds([]);
    setFeedback(null);
    setSteps(0);

    if (targetMode === 'basic') {
      const nextTree = relabelTree(generateRandomCircuit(targetType, 0, 3), targetType);
      setTree(nextTree);
      return;
    }

    const { nodes, edges } = generateGridCircuit(targetType, targetValueMode);
    setGraphNodes(nodes);
    setGraphEdges(edges);
  }, [compType, mode, valueMode]);

  const changeMode = useCallback((nextMode) => {
    setMode(nextMode);
    initCircuit(nextMode, compType, valueMode);
  }, [compType, initCircuit, valueMode]);

  const changeComponentType = useCallback((nextType) => {
    setCompType(nextType);
    initCircuit(mode, nextType, valueMode);
  }, [initCircuit, mode, valueMode]);

  const changeValueMode = useCallback((nextValueMode) => {
    setValueMode(nextValueMode);
    initCircuit(mode, compType, nextValueMode);
  }, [compType, initCircuit, mode]);

  const handleSelect = useCallback((id) => {
    if (!id) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
    setFeedback(null);
  }, []);

  const setError = useCallback((message) => {
    setFeedback({ type: 'error', text: message, key: feedbackKey + 1 });
    setFeedbackKey((key) => key + 1);
  }, [feedbackKey]);

  const handleCombine = useCallback((action) => {
    if (mode === 'basic') {
      const result = validateSelection(tree, selectedIds, action);
      if (!result.valid) {
        setError(result.message);
        return;
      }

      const nextTree = combineNodes(tree, selectedIds, action, compType);
      setTree(nextTree);
      setSelectedIds([]);
      setSteps((value) => value + 1);
      if (nextTree.type === 'leaf') {
        setFeedback({ type: 'victory', val: nextTree.val });
      } else {
        setFeedback({
          type: 'success',
          text: `Combinación correcta: conexión en ${action === 'series' ? 'serie' : 'paralelo'}.`,
          key: feedbackKey + 1,
        });
        setFeedbackKey((key) => key + 1);
      }
      return;
    }

    const result = validateGraphSelection(graphNodes, graphEdges, selectedIds, action);
    if (!result.valid) {
      setError(result.message);
      return;
    }

    const nextGraph = combineGraphEdges(graphNodes, graphEdges, selectedIds, action, compType);
    setGraphNodes(nextGraph.nodes);
    setGraphEdges(nextGraph.edges);
    setSelectedIds([]);
    setSteps((value) => value + 1);
    if (nextGraph.edges.length === 1) {
      setFeedback({ type: 'victory', val: nextGraph.edges[0].val });
    } else {
      setFeedback({
        type: 'success',
        text: `Combinación correcta: conexión en ${action === 'series' ? 'serie' : 'paralelo'}.`,
        key: feedbackKey + 1,
      });
      setFeedbackKey((key) => key + 1);
    }
  }, [compType, feedbackKey, graphEdges, graphNodes, mode, selectedIds, setError, tree]);

  const handleDeleteSwitch = useCallback(() => {
    if (selectedIds.length !== 1) return;

    const nextGraph = deleteGraphEdge(graphNodes, graphEdges, selectedIds[0]);
    setGraphNodes(nextGraph.nodes);
    setGraphEdges(nextGraph.edges);
    setSelectedIds([]);
    setSteps((value) => value + 1);

    if (nextGraph.edges.length === 1) {
      setFeedback({ type: 'victory', val: nextGraph.edges[0].val });
    } else {
      setFeedback({
        type: 'success',
        text: 'Interruptor abierto eliminado. Las ramas muertas fueron podadas.',
        key: feedbackKey + 1,
      });
      setFeedbackKey((key) => key + 1);
    }
  }, [feedbackKey, graphEdges, graphNodes, selectedIds]);

  const openSwitchSelected = useMemo(() => (
    mode === 'advanced'
      && selectedIds.length === 1
      && graphEdges.some((edge) => (
        edge.id === selectedIds[0]
        && edge.compType === 'S'
        && edge.switchState === 'open'
      ))
  ), [graphEdges, mode, selectedIds]);

  const isSolved = feedback?.type === 'victory';
  const eqVal = feedback?.val ?? 0;
  const componentName = compType === 'R' ? 'Resistencias' : 'Capacitores';

  if (mode === 'basic' && !tree) return null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Zap size={22} /></div>
          <div>
            <p className="brand-kicker">Laboratorio 01</p>
            <p className="brand-name">Circuitos en equilibrio</p>
          </div>
        </div>

        <div className="topbar-controls">
          <div className="segmented-control" role="group" aria-label="Modo de práctica">
            <button
              className={mode === 'basic' ? 'is-active' : ''}
              aria-pressed={mode === 'basic'}
              onClick={() => changeMode('basic')}
            >
              Básico
            </button>
            <button
              className={mode === 'advanced' ? 'is-active' : ''}
              aria-pressed={mode === 'advanced'}
              onClick={() => changeMode('advanced')}
            >
              <Grid3X3 size={14} /> Avanzado
            </button>
          </div>

          <div className="segmented-control segmented-control--component" role="group" aria-label="Tipo de componente">
            <button
              className={compType === 'R' ? 'is-active' : ''}
              aria-pressed={compType === 'R'}
              onClick={() => changeComponentType('R')}
            >
              R
            </button>
            <button
              className={compType === 'C' ? 'is-active' : ''}
              aria-pressed={compType === 'C'}
              onClick={() => changeComponentType('C')}
            >
              C
            </button>
          </div>

          {mode === 'advanced' && (
            <div className="segmented-control segmented-control--values" role="group" aria-label="Distribución de valores">
              <button
                className={valueMode === 'varied' ? 'is-active' : ''}
                aria-pressed={valueMode === 'varied'}
                onClick={() => changeValueMode('varied')}
              >
                Variados
              </button>
              <button
                className={valueMode === 'equal' ? 'is-active' : ''}
                aria-pressed={valueMode === 'equal'}
                onClick={() => changeValueMode('equal')}
              >
                Iguales
              </button>
            </div>
          )}

          <button
            className={`topbar-tool ${showFormulas ? 'is-active' : ''}`}
            aria-pressed={showFormulas}
            onClick={() => setShowFormulas((open) => !open)}
          >
            <BookOpen size={16} /> Fórmulas
          </button>
          <button
            className={`topbar-tool ${isMessy ? 'is-active is-warning' : ''}`}
            aria-pressed={isMessy}
            onClick={() => setIsMessy((value) => !value)}
          >
            <Shuffle size={16} /> Malla con ruido
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="exercise-heading">
          <div className="heading-copy">
            <span className="eyebrow"><span className="eyebrow-pip" /> Práctica guiada</span>
            <h1>Simplifica el circuito sin perderte en la malla.</h1>
            <p>
              Lee la topología, selecciona los componentes vecinos y decide si forman
              una conexión en serie o en paralelo.
            </p>
          </div>

          <div className="telemetry" aria-label="Estado del ejercicio">
            <div className="telemetry-cell">
              <span className="telemetry-label">Paso</span>
              <strong>{String(steps).padStart(2, '0')}</strong>
            </div>
            <div className="telemetry-cell">
              <span className="telemetry-label">Selección</span>
              <strong>{String(selectedIds.length).padStart(2, '0')}</strong>
            </div>
            <div className="telemetry-state">
              <span className={`status-lamp ${isSolved ? 'is-solved' : ''}`} />
              <span>{isSolved ? 'Circuito medido' : 'Fuente activa · 12 V'}</span>
            </div>
          </div>
        </section>

        <section className="control-strip" aria-label="Acciones del ejercicio">
          <div className="instruction-copy">
            <span className="instruction-label">{mode === 'basic' ? 'Modo básico' : 'Modo avanzado'}</span>
            <span>{isSolved ? 'Resultado registrado.' : 'Selecciona dos o más elementos para habilitar una regla.'}</span>
          </div>

          <div className="action-group">
            <button
              className="button button--series"
              disabled={selectedIds.length < 2 || isSolved}
              onClick={() => handleCombine('series')}
            >
              <Spline size={17} /> Serie
            </button>
            <button
              className="button button--parallel"
              disabled={selectedIds.length < 2 || isSolved}
              onClick={() => handleCombine('parallel')}
            >
              <Layers size={17} /> Paralelo
            </button>
            {openSwitchSelected && (
              <button className="button button--danger" onClick={handleDeleteSwitch}>
                <XCircle size={17} /> Eliminar abierto
              </button>
            )}
            <button className="button button--quiet" onClick={() => initCircuit()}>
              <RefreshCw size={16} /> Nuevo circuito
            </button>
          </div>
        </section>

        <FeedbackBanner feedback={feedback} mode={mode} />

        <section className="workbench-grid">
          <section className="circuit-panel" aria-label={`Circuito de ${componentName.toLowerCase()}`}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Mesa de trabajo</span>
                <h2>{mode === 'basic' ? 'Reducción por bloques' : 'Lectura topológica'}</h2>
              </div>
              <div className="panel-readout">
                <span className="readout-dot" />
                {mode === 'basic' ? 'Árbol de conexiones' : `${graphEdges.length} elementos activos`}
              </div>
            </div>

            <div className="circuit-stage">
              {mode === 'basic' && tree && (
                <CircuitSVG
                  tree={tree}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  isMessy={isMessy}
                />
              )}
              {mode === 'advanced' && (
                <GridCircuitSVG
                  nodes={graphNodes}
                  edges={graphEdges}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  isMessy={isMessy}
                />
              )}
              {isSolved && (
                <VictoryOverlay
                  eqVal={eqVal}
                  compType={compType}
                  steps={steps}
                  onNext={() => initCircuit()}
                />
              )}
            </div>

            <div className="circuit-legend" aria-label="Leyenda de símbolos">
              <span><i className="legend-symbol legend-symbol--resistor" /> Resistencia</span>
              <span><i className="legend-symbol legend-symbol--capacitor" /> Capacitor</span>
              <span><i className="legend-symbol legend-symbol--switch" /> Interruptor</span>
              <span><i className="legend-symbol legend-symbol--wire" /> Cable</span>
            </div>
          </section>

          {showFormulas && <FormulaPanel compType={compType} />}
        </section>
      </main>

      <footer className="app-footer">
        <span>Electricidad y magnetismo</span>
        <span className="footer-separator" />
        <span>Piensa la conexión antes de combinar.</span>
      </footer>
    </div>
  );
}

export default App;

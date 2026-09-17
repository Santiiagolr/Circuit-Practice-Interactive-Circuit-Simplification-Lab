import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Grid3X3,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  RefreshCw,
  Spline,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  DIFFICULTY_PRESETS,
  formatValue,
  generateBasicExercise,
  getTreeStats,
  combineNodes,
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

const PROGRESS_KEY = 'circuit-practice:progress:v1';
const POINTS_BY_DIFFICULTY = {
  guided: 10,
  practice: 20,
  challenge: 35,
};

const EMPTY_PROGRESS = {
  score: 0,
  streak: 0,
  bestStreak: 0,
  completed: 0,
};
const INITIAL_SEED = Date.now();

function safeProgressValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
}

function readProgress() {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;

  try {
    const stored = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || '{}');
    return {
      score: safeProgressValue(stored.score),
      streak: safeProgressValue(stored.streak),
      bestStreak: safeProgressValue(stored.bestStreak),
      completed: safeProgressValue(stored.completed),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function makeHistoryKey(mode, compType, difficulty, valueMode) {
  return [mode, compType, difficulty, valueMode].join(':');
}

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
        <span>
          Primero identifica la conexión. Después elige la regla. El flujo animado es
          una guía visual y solo está disponible para resistencias.
        </span>
      </div>
    </aside>
  );
}

const confettiPieces = Array.from({ length: 24 }, (_, index) => ({
  left: ((index * 37) % 101) + '%',
  top: ((index * 19) % 38) + '%',
  delay: ((index % 7) * 0.08) + 's',
  duration: (1.2 + (index % 5) * 0.16) + 's',
  size: (6 + (index % 4) * 2) + 'px',
  shape: index % 3 === 0 ? '50%' : '3px',
  color: ['#37D6C0', '#FFB454', '#78A8FF', '#EF7770'][index % 4],
}));

function VictoryOverlay({ eqVal, compType, steps, reward, onNext }) {
  const value = compType === 'R' ? formatValue(eqVal, compType) : gFormatValue(eqVal, compType);
  const cleanMessage = reward?.clean
    ? 'Resolución limpia: la racha sigue creciendo.'
    : 'Circuito resuelto. En el próximo intento podés recuperar la racha.';

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
        <p>
          Encontraste el componente equivalente en {steps} paso{steps === 1 ? '' : 's'}.
          {' '}{cleanMessage}
        </p>
        <div className="equivalent-readout">
          <span>{compType === 'R' ? 'Resistencia' : 'Capacitancia'} equivalente</span>
          <strong>{value}</strong>
        </div>
        <div className="victory-reward" aria-label="Recompensa del ejercicio">
          <span>+{reward?.points || 0} puntos</span>
          <span><Flame size={14} /> Racha {reward?.streak || 0}</span>
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
      className={
        'feedback-banner'
        + (isError ? ' feedback-banner--error' : '')
        + (isSuccess ? ' feedback-banner--success' : '')
      }
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

function Telemetry({ steps, mistakes, score, streak, bestStreak, isSolved, compact = false }) {
  return (
    <div className={'telemetry' + (compact ? ' telemetry--topbar' : '')} aria-label="Estado del ejercicio">
      <div className="telemetry-cell">
        <span className="telemetry-label">Paso</span>
        <strong>{String(steps).padStart(2, '0')}</strong>
      </div>
      <div className="telemetry-cell">
        <span className="telemetry-label">Fallos</span>
        <strong>{String(mistakes).padStart(2, '0')}</strong>
      </div>
      <div className="telemetry-cell">
        <span className="telemetry-label">Puntos</span>
        <strong>{score}</strong>
      </div>
      <div className="telemetry-cell telemetry-cell--streak">
        <span className="telemetry-label">Racha</span>
        <strong>{streak}</strong>
        <small>mejor {bestStreak}</small>
      </div>
      <div className="telemetry-state">
        <span className={'status-lamp' + (isSolved ? ' is-solved' : '')} />
        <span>{isSolved ? 'Circuito medido' : 'Fuente activa · 12 V'}</span>
      </div>
    </div>
  );
}

function ExerciseActions({
  selectedCount,
  isSolved,
  openSwitchSelected,
  onCombine,
  onDeleteSwitch,
  onNewCircuit,
  compact = false,
}) {
  return (
    <div className={'action-group' + (compact ? ' action-group--topbar' : '')} aria-label="Acciones de reducción">
      <button
        className="button button--series"
        disabled={selectedCount < 2 || isSolved}
        onClick={() => onCombine('series')}
      >
        <Spline size={17} /> Serie
      </button>
      <button
        className="button button--parallel"
        disabled={selectedCount < 2 || isSolved}
        onClick={() => onCombine('parallel')}
      >
        <Layers size={17} /> Paralelo
      </button>
      {openSwitchSelected && (
        <button className="button button--danger" onClick={onDeleteSwitch}>
          <XCircle size={17} /> Eliminar abierto
        </button>
      )}
      <button className="button button--quiet" onClick={onNewCircuit}>
        <RefreshCw size={16} /> Nuevo circuito
      </button>
    </div>
  );
}

function App() {
  const feedbackKeyRef = useRef(0);
  const historyRef = useRef({});
  const historyInitializedRef = useRef(false);
  const circuitPanelRef = useRef(null);

  const [mode, setMode] = useState('basic');
  const [compType, setCompType] = useState('R');
  const [difficulty, setDifficulty] = useState('guided');
  const [isWorkspaceFullscreen, setIsWorkspaceFullscreen] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showFlow, setShowFlow] = useState(true);
  const [valueMode, setValueMode] = useState('varied');
  const [basicExercise, setBasicExercise] = useState(() => (
    generateBasicExercise('R', {
      difficulty: 'guided',
      seed: INITIAL_SEED,
      valueMode: 'varied',
    })
  ));
  const [graphExercise, setGraphExercise] = useState(() => (
    generateGridCircuit('R', 'varied', {
      difficulty: 'guided',
      seed: INITIAL_SEED + 1,
    })
  ));
  const [selectedIds, setSelectedIds] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [steps, setSteps] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [exerciseHadMistake, setExerciseHadMistake] = useState(false);
  const [currentSeed, setCurrentSeed] = useState(INITIAL_SEED);
  const [reward, setReward] = useState(null);
  const [progress, setProgress] = useState(readProgress);

  const tree = basicExercise?.tree;
  const graphNodes = graphExercise.nodes;
  const graphEdges = graphExercise.edges;
  const isSolved = feedback?.type === 'victory';
  const eqVal = feedback?.val ?? 0;
  const componentName = compType === 'R' ? 'Resistencias' : 'Capacitores';
  const flowActive = showFlow && compType === 'R';

  useEffect(() => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsWorkspaceFullscreen(document.fullscreenElement === circuitPanelRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleWorkspaceFullscreen = useCallback(async () => {
    if (document.fullscreenElement === circuitPanelRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (isWorkspaceFullscreen && !document.fullscreenElement) {
      setIsWorkspaceFullscreen(false);
      return;
    }

    const panel = circuitPanelRef.current;
    if (!panel) return;

    if (!panel.requestFullscreen) {
      setIsWorkspaceFullscreen(true);
      return;
    }

    try {
      await panel.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Some embedded browsers expose the API but reject it. The CSS fallback
      // still gives the user a usable full-workbench mode.
      setIsWorkspaceFullscreen(true);
    }
  }, [isWorkspaceFullscreen]);

  useEffect(() => {
    if (historyInitializedRef.current) return;

    historyRef.current[makeHistoryKey('basic', 'R', 'guided', 'varied')] = [basicExercise.signature];
    historyRef.current[makeHistoryKey('advanced', 'R', 'guided', 'varied')] = [graphExercise.signature];
    historyInitializedRef.current = true;
  }, [basicExercise.signature, graphExercise.signature]);

  const publishFeedback = useCallback((type, text, val) => {
    feedbackKeyRef.current += 1;
    setFeedback({
      type,
      text,
      val,
      key: feedbackKeyRef.current,
    });
  }, []);

  const rememberSignature = useCallback((targetMode, targetType, targetDifficulty, targetValueMode, signature) => {
    const key = makeHistoryKey(targetMode, targetType, targetDifficulty, targetValueMode);
    const recent = historyRef.current[key] || [];
    historyRef.current[key] = recent.concat(signature).slice(-18);
  }, []);

  const createExercise = useCallback((
    targetMode = mode,
    targetType = compType,
    targetDifficulty = difficulty,
    targetValueMode = valueMode,
    options = {},
  ) => {
    const nextSeed = currentSeed + 1;
    const historyKey = makeHistoryKey(targetMode, targetType, targetDifficulty, targetValueMode);
    const recentSignatures = historyRef.current[historyKey] || [];
    if (targetMode === 'basic') {
      const nextExercise = generateBasicExercise(targetType, {
        difficulty: targetDifficulty,
        seed: nextSeed,
        valueMode: targetValueMode,
        recentSignatures,
      });
      setBasicExercise(nextExercise);
      rememberSignature(
        targetMode,
        targetType,
        targetDifficulty,
        targetValueMode,
        nextExercise.signature,
      );
    } else {
      const nextExercise = generateGridCircuit(targetType, targetValueMode, {
        difficulty: targetDifficulty,
        seed: nextSeed,
        recentSignatures,
      });
      setGraphExercise(nextExercise);
      rememberSignature(
        targetMode,
        targetType,
        targetDifficulty,
        targetValueMode,
        nextExercise.signature,
      );
    }

    setCurrentSeed(nextSeed);
    setSelectedIds([]);
    setFeedback(null);
    setReward(null);
    setSteps(0);
    setMistakes(0);
    setExerciseHadMistake(false);
    setShowFlow((current) => targetType === 'R' ? current : false);

    if (options.breakStreak !== false) {
      setProgress((current) => ({ ...current, streak: 0 }));
    }
  }, [
    compType,
    difficulty,
    mode,
    currentSeed,
    rememberSignature,
    valueMode,
  ]);

  const changeMode = useCallback((nextMode) => {
    setMode(nextMode);
    createExercise(nextMode, compType, difficulty, valueMode);
  }, [compType, createExercise, difficulty, valueMode]);

  const changeComponentType = useCallback((nextType) => {
    setCompType(nextType);
    createExercise(mode, nextType, difficulty, valueMode);
  }, [createExercise, difficulty, mode, valueMode]);

  const changeDifficulty = useCallback((nextDifficulty) => {
    setDifficulty(nextDifficulty);
    createExercise(mode, compType, nextDifficulty, valueMode);
  }, [compType, createExercise, mode, valueMode]);

  const changeValueMode = useCallback((nextValueMode) => {
    setValueMode(nextValueMode);
    createExercise(mode, compType, difficulty, nextValueMode);
  }, [compType, createExercise, difficulty, mode]);

  const handleSelect = useCallback((id) => {
    if (isSolved) return;
    if (!id) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.concat(id)
    ));
    setFeedback(null);
  }, [isSolved]);

  const setError = useCallback((message) => {
    setExerciseHadMistake(true);
    setMistakes((current) => current + 1);
    setProgress((current) => ({ ...current, streak: 0 }));
    publishFeedback('error', message);
  }, [publishFeedback]);

  const completeExercise = useCallback((value) => {
    const clean = !exerciseHadMistake;
    const nextStreak = clean ? progress.streak + 1 : 0;
    const basePoints = POINTS_BY_DIFFICULTY[difficulty] || POINTS_BY_DIFFICULTY.guided;
    const streakBonus = clean ? Math.min(30, Math.max(0, (nextStreak - 1) * 5)) : 0;
    const earnedPoints = basePoints + streakBonus;

    setProgress((current) => ({
      ...current,
      score: current.score + earnedPoints,
      streak: nextStreak,
      bestStreak: Math.max(current.bestStreak, nextStreak),
      completed: current.completed + 1,
    }));
    setReward({
      points: earnedPoints,
      streak: nextStreak,
      clean,
    });
    publishFeedback('victory', 'Medición correcta. El equivalente quedó conectado a la batería.', value);
  }, [difficulty, exerciseHadMistake, progress, publishFeedback]);

  const handleCombine = useCallback((action) => {
    if (isSolved) return;

    if (mode === 'basic') {
      const result = validateSelection(tree, selectedIds, action);
      if (!result.valid) {
        setError(result.message);
        return;
      }

      const nextTree = combineNodes(tree, selectedIds, action, compType);
      setBasicExercise((current) => ({ ...current, tree: nextTree }));
      setSelectedIds([]);
      const nextStepCount = steps + 1;
      setSteps(nextStepCount);

      if (nextTree.type === 'leaf') {
        completeExercise(nextTree.val);
      } else {
        publishFeedback(
          'success',
          'Combinación correcta: conexión en ' + (action === 'series' ? 'serie.' : 'paralelo.'),
        );
      }
      return;
    }

    const selectedEdges = graphEdges.filter((edge) => selectedIds.includes(edge.id));
    if (selectedEdges.some((edge) => edge.compType === 'S' && edge.switchState === 'open')) {
      setError('Un interruptor abierto equivale a una rama desconectada. Seleccionalo solo y pulsa "Eliminar abierto".');
      return;
    }

    const result = validateGraphSelection(graphNodes, graphEdges, selectedIds, action);
    if (!result.valid) {
      setError(result.message);
      return;
    }

    const nextGraph = combineGraphEdges(graphNodes, graphEdges, selectedIds, action, compType);
    setGraphExercise((current) => ({
      ...current,
      nodes: nextGraph.nodes,
      edges: nextGraph.edges,
    }));
    setSelectedIds([]);
    const nextStepCount = steps + 1;
    setSteps(nextStepCount);

    if (nextGraph.edges.length === 1) {
      completeExercise(nextGraph.edges[0].val);
    } else {
      publishFeedback(
        'success',
        'Combinación correcta: conexión en ' + (action === 'series' ? 'serie.' : 'paralelo.'),
      );
    }
  }, [
    compType,
    completeExercise,
    graphEdges,
    graphNodes,
    isSolved,
    mode,
    publishFeedback,
    selectedIds,
    setError,
    steps,
    tree,
  ]);

  const handleDeleteSwitch = useCallback(() => {
    if (mode !== 'advanced' || selectedIds.length !== 1) {
      setError('Selecciona un único interruptor abierto para eliminarlo.');
      return;
    }

    const selectedSwitch = graphEdges.find((edge) => edge.id === selectedIds[0]);
    if (!selectedSwitch || selectedSwitch.compType !== 'S' || selectedSwitch.switchState !== 'open') {
      setError('Solo se pueden eliminar interruptores en estado abierto.');
      return;
    }

    const nextGraph = deleteGraphEdge(graphNodes, graphEdges, selectedIds[0]);
    setGraphExercise((current) => ({
      ...current,
      nodes: nextGraph.nodes,
      edges: nextGraph.edges,
    }));
    setSelectedIds([]);
    const nextStepCount = steps + 1;
    setSteps(nextStepCount);

    if (nextGraph.edges.length === 1) {
      completeExercise(nextGraph.edges[0].val);
    } else {
      publishFeedback(
        'success',
        'Interruptor abierto eliminado. Las ramas muertas fueron podadas.',
      );
    }
  }, [
    completeExercise,
    graphEdges,
    graphNodes,
    mode,
    publishFeedback,
    selectedIds,
    setError,
    steps,
  ]);

  const openSwitchSelected = useMemo(() => (
    mode === 'advanced'
      && selectedIds.length === 1
      && graphEdges.some((edge) => (
        edge.id === selectedIds[0]
        && edge.compType === 'S'
        && edge.switchState === 'open'
      ))
  ), [graphEdges, mode, selectedIds]);

  const activeCount = mode === 'basic'
    ? (tree ? getTreeStats(tree).leaves : 0)
    : graphEdges.length;
  const panelReadout = mode === 'basic'
    ? activeCount + ' componentes activos · semilla ' + currentSeed
    : graphEdges.length + ' elementos activos · semilla ' + currentSeed;
  const difficultyLabel = DIFFICULTY_PRESETS[difficulty]?.label || 'Guiado';

  if (mode === 'basic' && !tree) return null;

  return (
    <div className={'app-shell' + (isWorkspaceFullscreen ? ' is-workbench-fullscreen' : '')}>
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Zap size={22} /></div>
            <div>
              <p className="brand-kicker">Laboratorio 01</p>
              <p className="brand-name">Circuitos en equilibrio</p>
            </div>
          </div>

          <div className="topbar-quick">
            <Telemetry
              steps={steps}
              mistakes={mistakes}
              score={progress.score}
              streak={progress.streak}
              bestStreak={progress.bestStreak}
              isSolved={isSolved}
              compact
            />
            <ExerciseActions
              selectedCount={selectedIds.length}
              isSolved={isSolved}
              openSwitchSelected={openSwitchSelected}
              onCombine={handleCombine}
              onDeleteSwitch={handleDeleteSwitch}
              onNewCircuit={() => createExercise()}
              compact
            />
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

          <div className="segmented-control segmented-control--difficulty" role="group" aria-label="Dificultad">
            {Object.entries(DIFFICULTY_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                className={difficulty === key ? 'is-active' : ''}
                aria-pressed={difficulty === key}
                onClick={() => changeDifficulty(key)}
              >
                {preset.label}
              </button>
            ))}
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
            className={'topbar-tool' + (showFormulas ? ' is-active' : '')}
            aria-pressed={showFormulas}
            onClick={() => setShowFormulas((open) => !open)}
          >
            <BookOpen size={16} /> Fórmulas
          </button>
          <button
            className={'topbar-tool' + (flowActive ? ' is-active' : '')}
            aria-pressed={flowActive}
            disabled={compType !== 'R'}
            title={compType === 'R' ? 'Mostrar flujo ilustrativo' : 'Disponible para resistencias'}
            onClick={() => setShowFlow((current) => !current)}
          >
            <Activity size={16} /> Flujo
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="exercise-heading">
          <div className="heading-copy">
            <span className="eyebrow"><span className="eyebrow-pip" /> Práctica adaptativa</span>
            <h1>Simplifica el circuito sin perderte en la malla.</h1>
            <p>
              Lee la topología, selecciona los componentes vecinos y decide si forman
              una conexión en serie o en paralelo. El circuito se ajusta al espacio
              disponible para que puedas leerlo completo también en teléfono.
            </p>
          </div>
        </section>

        <section className="control-strip" aria-label="Acciones del ejercicio">
          <div className="instruction-copy">
            <span className="instruction-label">
              {mode === 'basic' ? 'Modo básico' : 'Modo avanzado'} · {difficultyLabel}
            </span>
            <span>
              {isSolved
                ? 'Resultado registrado.'
                : 'Selecciona dos o más elementos para habilitar una regla.'}
            </span>
          </div>

          <span className="control-strip-note">Controles de reducción fijados en la cabecera.</span>
        </section>

        <FeedbackBanner feedback={feedback} mode={mode} />

        <section className="workbench-grid">
          <section
            ref={circuitPanelRef}
            className={'circuit-panel' + (isWorkspaceFullscreen ? ' is-fullscreen-workbench' : '')}
            aria-label={'Circuito de ' + componentName.toLowerCase()}
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Mesa de trabajo</span>
                <h2>{mode === 'basic' ? 'Reducción por bloques' : 'Lectura topológica'}</h2>
              </div>
              <div className="panel-heading__tools">
                <div className="panel-readout" title={panelReadout}>
                  <span className="readout-dot" />
                  {panelReadout}
                </div>
                <button
                  type="button"
                  className="panel-fullscreen-button"
                  aria-pressed={isWorkspaceFullscreen}
                  aria-label={isWorkspaceFullscreen ? 'Salir de pantalla completa' : 'Abrir mesa de trabajo en pantalla completa'}
                  title={isWorkspaceFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  onClick={toggleWorkspaceFullscreen}
                >
                  {isWorkspaceFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  <span>{isWorkspaceFullscreen ? 'Salir' : 'Pantalla completa'}</span>
                </button>
              </div>
            </div>

            {isWorkspaceFullscreen && (
              <div className="fullscreen-toolbar" aria-label="Controles de la mesa de trabajo">
                <Telemetry
                  steps={steps}
                  mistakes={mistakes}
                  score={progress.score}
                  streak={progress.streak}
                  bestStreak={progress.bestStreak}
                  isSolved={isSolved}
                />
                <ExerciseActions
                  selectedCount={selectedIds.length}
                  isSolved={isSolved}
                  openSwitchSelected={openSwitchSelected}
                  onCombine={handleCombine}
                  onDeleteSwitch={handleDeleteSwitch}
                  onNewCircuit={() => createExercise()}
                />
              </div>
            )}

            <div className="circuit-stage">
              {mode === 'basic' && tree && (
                <CircuitSVG
                  tree={tree}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  showFlow={flowActive}
                />
              )}
              {mode === 'advanced' && (
                <GridCircuitSVG
                  nodes={graphNodes}
                  edges={graphEdges}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  showFlow={flowActive}
                  sourceRoute={graphExercise.sourceRoute}
                  sourceSymbol={graphExercise.sourceSymbol}
                  equivalentRoute={graphExercise.equivalentRoute}
                  layout={graphExercise.layout}
                />
              )}
              {isSolved && (
                <VictoryOverlay
                  eqVal={eqVal}
                  compType={compType}
                  steps={steps}
                  reward={reward}
                  onNext={() => createExercise(mode, compType, difficulty, valueMode, { breakStreak: false })}
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
        <span>{progress.completed} circuitos completados · Piensa la conexión antes de combinar.</span>
      </footer>
    </div>
  );
}

export default App;

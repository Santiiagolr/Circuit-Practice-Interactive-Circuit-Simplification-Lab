import { useEffect, useRef, useState } from 'react';
import { isComplete, LEVELS } from '../lib/exercise.js';
import { TOPICS } from '../lib/topicPractice.js';
import { formatExact } from '../lib/values.js';
import TechnicalCircuit from './TechnicalCircuit.jsx';
import ArithmeticEntry from './ArithmeticEntry.jsx';
import { ReductionExplanation } from './PracticeHistory.jsx';
import { CompletionPresentation, ScoreFeedback, StepStreakIndicator } from './GameAnimations.jsx';

export default function Workbench({ state, dispatch, feedback, visible, deskRef, concentration, onConcentration, onNew, onFinishExam, onNext, remaining }) {
  const [componentsOpen, setComponentsOpen] = useState(() => !window.matchMedia?.('(max-width: 900px)')?.matches);
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [previousVisible, setPreviousVisible] = useState(visible);
  if (previousVisible !== visible) { setPreviousVisible(visible); if (!visible) setFullscreen(false); }
  const fullscreenButton = useRef(null), concentrationButton = useRef(null);
  const fullscreenIntent = useRef(false);
  const { settings, current, progress, exam, topicSession } = state;
  const { exercise } = current;
  const complete = isComplete(exercise), activeExam = exam?.status === 'active';
  const locked = current.submitted || (settings.mode === 'exam' && !activeExam);
  const mistakes = current.attempts.filter(item => item.kind === 'error').length;
  const steps = current.attempts.filter(item => item.kind === 'reduction').length;
  const lastStep = current.attempts.findLast(item => item.kind === 'reduction');
  const activeTopic = TOPICS.find(topic => topic.id === topicSession?.topicId);
  const submittedItem = current.submitted ? state.history.findLast(item => item.id === exercise.id && item.status === 'complete') : null;
  const liveCompletion = feedback.completion?.exerciseId === exercise.id && feedback.completion.source === 'workbench' ? feedback.completion : null;
  const completion = liveCompletion || (submittedItem && { settings: submittedItem.settings || settings, equivalent: submittedItem.final?.edges?.[0]?.value || exercise.edges[0].value, errors: submittedItem.errors, repeat: submittedItem.repeat, stepPoints: submittedItem.stepPoints || 0, rewardPoints: submittedItem.reward?.points || 0 });
  const feedbackState = current.notice?.kind || (complete ? 'success' : current.selected.length ? 'selection' : 'guide');
  const feedbackMessage = current.notice?.message || (complete ? 'Circuito reducido. Revisá el resultado y entregalo cuando estés listo.' : !current.selected.length ? 'Seleccioná dos o más componentes para comenzar.' : current.selected.length === 1 ? 'Elegí al menos otro componente y decidí qué regla corresponde.' : 'Compará las conexiones y elegí Serie o Paralelo para aplicar tu razonamiento.');
  const clear = () => dispatch({ type: 'clear' });

  useEffect(() => {
    const change = () => {
      const enabled = document.fullscreenElement === deskRef.current;
      if (enabled && !fullscreenIntent.current) { document.exitFullscreen().catch(() => {}); return; }
      setNativeFullscreen(enabled); setFullscreen(enabled);
      if (!enabled) { fullscreenIntent.current = false; fullscreenButton.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, [deskRef]);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [fullscreen]);
  useEffect(() => {
    if (!visible) {
      fullscreenIntent.current = false;
      if (document.fullscreenElement === deskRef.current) document.exitFullscreen().catch(() => {});
    }
  }, [visible, deskRef]);
  useEffect(() => {
    const escape = event => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if (fullscreen) {
        fullscreenIntent.current = false;
        if (document.fullscreenElement === deskRef.current) document.exitFullscreen().catch(() => {});
        setFullscreen(false); fullscreenButton.current?.focus();
      }
      if (concentration) { onConcentration(false); concentrationButton.current?.focus(); }
    };
    if (visible) window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [visible, fullscreen, concentration, onConcentration, deskRef]);
  async function toggleFullscreen() {
    if (fullscreen) {
      fullscreenIntent.current = false;
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setFullscreen(false); fullscreenButton.current?.focus(); return;
    }
    fullscreenIntent.current = true;
    setFullscreen(true);
    try { await deskRef.current.requestFullscreen(); } catch { setNativeFullscreen(false); }
  }
  return <div hidden={!visible} className="bench-view">
    <section ref={deskRef} className={`workbench ${fullscreen ? 'desk-fullscreen' : ''} ${fullscreen && !nativeFullscreen ? 'css-fullscreen' : ''} ${current.pending ? 'has-pending-answer' : ''}`} aria-label="Mesa de trabajo">
      <header className="desk-header">
        <div className="exercise-heading"><h2 tabIndex={-1}>{activeExam ? `Parcial · ${exam.results.length + 1}/${exam.count}` : activeTopic ? `Tema · ${activeTopic.shortTitle}` : 'Entrenamiento'} <span>/ {LEVELS[settings.difficulty].label}</span></h2><p>{settings.compType === 'R' ? 'Resistencias' : settings.compType === 'C' ? 'Capacitores' : 'Inductores ideales sin acoplamiento'} · {exercise.family}</p></div>
        <div className="telemetry" aria-label="Progreso"><span>Pasos <b data-testid="steps">{steps}</b></span><span>Fallos <b>{mistakes}</b></span><span className="telemetry-score">Puntos <ScoreFeedback value={progress.score} event={feedback.score} /></span><StepStreakIndicator compact value={progress.stepStreak} event={feedback.streak} />{remaining !== null && activeExam && <span aria-label="Tiempo restante" className="exam-clock">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}</div>
        <div className="desk-view-actions"><button ref={concentrationButton} aria-pressed={concentration} onClick={() => onConcentration(!concentration)}>{concentration ? 'Salir de concentración' : 'Concentración'}</button><button aria-expanded={componentsOpen} aria-controls="workbench-components" onClick={() => setComponentsOpen(value => !value)}>Componentes <span aria-hidden="true">{componentsOpen ? '−' : '+'}</span></button><button ref={fullscreenButton} onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{fullscreen ? 'Salir ⤡' : 'Ampliar ⤢'}</button></div>
      </header>
      <div className="action-bar" role="group" aria-label="Acciones del circuito">
        <div className="reduction-actions"><button className="primary" onClick={() => dispatch({ type: 'reduce', rule: 'series' })} disabled={locked || complete || current.selected.length < 2 || !!current.pending}>Serie <kbd>Q</kbd></button><button className="primary" onClick={() => dispatch({ type: 'reduce', rule: 'parallel' })} disabled={locked || complete || current.selected.length < 2 || !!current.pending}>Paralelo <kbd>E</kbd></button>{current.selected.some(id => exercise.edges.find(edge => edge.id === id)?.switchState === 'open') && <button onClick={() => dispatch({ type: 'reduce', rule: 'delete' })} disabled={locked || !!current.pending}>Eliminar abierto</button>}<span className="selection-count">{current.selected.length} seleccionados</span></div>
        <div className="secondary-actions"><button onClick={() => dispatch({ type: 'undo' })} disabled={locked || !current.past.length} title="Ctrl/Cmd + Z">Deshacer</button><button onClick={() => dispatch({ type: 'redo' })} disabled={locked || !current.future.length} title="Ctrl/Cmd + Mayús + Z">Rehacer</button>{activeExam ? <button onClick={event => { event.currentTarget.focus({ preventScroll: true }); onFinishExam(); }}>Finalizar parcial</button> : <button onClick={event => { event.currentTarget.focus({ preventScroll: true }); onNew(); }}>Nuevo circuito</button>}</div>
      </div>
      <div className={`desk-content ${componentsOpen ? '' : 'components-collapsed'}`}>
        <TechnicalCircuit key={exercise.id} exercise={exercise} settings={settings} reductionEvent={feedback.geometry} selected={current.selected} onSelect={id => dispatch({ type: 'select', id })} onClear={clear} disabled={locked || complete || !!current.pending} />
        <aside hidden={!componentsOpen} id="workbench-components" className="component-panel" aria-label="Selección de componentes"><div className="panel-heading"><h3>Componentes <span>{exercise.edges.length}</span></h3><button onClick={clear} disabled={!current.selected.length}>Limpiar</button></div><div className="component-list">{exercise.edges.map(edge => <button key={edge.id} className={`component-option ${edge.equivalent ? 'equivalent' : ''}`} data-testid={`component-${edge.id}`} aria-pressed={current.selected.includes(edge.id)} disabled={locked || complete || !!current.pending} onClick={() => dispatch({ type: 'select', id: edge.id })}><span className="component-check" aria-hidden="true">{current.selected.includes(edge.id) ? '✓' : ''}</span><strong>{edge.label}{edge.equivalent && <small>Eq.</small>}</strong><span className="numeric">{formatExact(edge.value, settings)}</span></button>)}</div><p className="panel-note">Serie y paralelo se reconocen por los nodos, no por la orientación del símbolo.</p>{settings.mode === 'training' && <button className="hint-button" disabled={locked || complete || !!current.pending} onClick={() => dispatch({ type: 'hint' })}>Pista conceptual</button>}</aside>
      </div>
      {current.pending ? <ArithmeticEntry current={current} settings={settings} dispatch={dispatch} /> : <div className={`feedback-strip ${feedbackState}`} role="status" aria-live={feedback.completion ? 'off' : 'polite'}>{current.notice?.kind === 'error' && !activeExam ? 'Conexión inválida. ' : ''}{feedbackMessage}</div>}
      {complete && <section className={`result-strip ${liveCompletion && !liveCompletion.repeat && !liveCompletion.motionDisabled ? 'is-celebrating' : ''}`} aria-label="Circuito reducido"><div>{current.submitted && completion ? <div role="status" aria-atomic="true"><CompletionPresentation event={completion} animated={Boolean(liveCompletion)} /></div> : <><strong>Equivalente: {formatExact(exercise.edges[0].value, settings)}</strong><p>{mistakes} errores · +{current.earnedStepPoints || 0} puntos por pasos. Podés deshacer para revisar antes de entregar.</p></>}</div>{!current.submitted && <button className="primary" onClick={() => dispatch({ type: 'submit' })}>{activeExam ? 'Entregar y continuar' : 'Entregar resultado'}</button>}{current.submitted && settings.mode !== 'exam' && <button className="primary" onClick={onNext}>Siguiente ejercicio</button>}</section>}
      {settings.mode === 'training' && lastStep && !current.pending && <details className="step-explanation"><summary>Última reducción: fórmula y sustitución</summary><ReductionExplanation step={lastStep} settings={settings} /></details>}
    </section>
    <footer className="practice-footer"><span>Reducción manual · Solo serie y paralelo</span><details><summary>Detalles del ejercicio</summary><p>Semilla {exercise.seed} · Fuente 12 V · Mejor racha {progress.bestStreak} · {progress.completed} entregados{settings.compType === 'L' ? ' · Inductores ideales sin acoplamiento. No se simula la evolución temporal.' : ''}</p></details></footer>
  </div>;
}

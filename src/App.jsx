import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import TechnicalCircuit from './components/TechnicalCircuit.jsx';
import PracticeSettings from './components/PracticeSettings.jsx';
import PracticeHistory, { ReductionExplanation } from './components/PracticeHistory.jsx';
import { isComplete, LEVELS } from './lib/exercise.js';
import { getQaConfig } from './lib/qaConfig.js';
import { loadSession, saveSession, sessionReducer } from './lib/session.js';
import { getReductionAction } from './lib/keyboardShortcuts.js';
import { Moon, Sun } from 'lucide-react';
import { formatExact } from './lib/values.js';
import './App.css';

function initialize() { return loadSession({ qa: getQaConfig() }); }
function ArithmeticEntry({ pending, settings, notice, dispatch }) {
  const [answer, setAnswer] = useState('');
  return <form className="arithmetic-entry" onSubmit={event => { event.preventDefault(); dispatch({ type: 'answer', text: answer }); }} aria-label="Calcular equivalente">
    <label htmlFor="equivalent-answer">Equivalente en {settings.representation === 'symbolic' ? settings.compType : settings.compType === 'R' ? settings.rUnit : settings.cUnit} ({pending.rule === 'series' ? 'serie' : 'paralelo'})</label>
    <div className="answer-row"><input id="equivalent-answer" autoFocus value={answer} onChange={event => setAnswer(event.target.value)} placeholder={settings.representation === 'symbolic' ? `3/2${settings.compType}` : 'Ej.: 12,5 o 25/2'} autoComplete="off" spellCheck="false" aria-describedby="answer-help" /><button className="primary" type="submit">Confirmar valor</button><button type="button" onClick={() => dispatch({ type: 'clear' })}>Cancelar</button></div>
    <p id="answer-help">Acepta fracciones, decimales y notación científica. {settings.representation === 'numeric' ? 'Redondeá a tres cifras significativas. Sin unidad, se usa la indicada.' : 'Ingresá un múltiplo exacto de la base.'} También podés escribir “cable” o “abierto”.</p>
    {notice && <p className={notice.kind === 'error' ? 'error-text' : ''} role="status">{notice.message}</p>}
  </form>;
}

export default function App() {
  const [loaded] = useState(initialize);
  const [state, rawDispatch] = useReducer(sessionReducer, loaded.state);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [fullscreen, setFullscreen] = useState(false), [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false), [now, setNow] = useState(Date.now);
  const restoreCircuitFocus = useRef(false);
  const desk = useRef(null), fullscreenButton = useRef(null);
  const dispatch = useCallback(action => rawDispatch({ ...action, now: Date.now() }), []);
  const { settings, current, progress, exam } = state;
  const { exercise } = current;
  const complete = isComplete(exercise), activeExam = exam?.status === 'active';
  const locked = current.submitted || (settings.mode === 'exam' && !activeExam);
  const mistakes = current.attempts.filter(item => item.kind === 'error').length;
  const steps = current.attempts.filter(item => item.kind === 'reduction').length;
  const lastStep = current.attempts.findLast(item => item.kind === 'reduction');
  useEffect(() => {
    const saved = () => setStorageWarning('El navegador no permite guardar la sesión. Podés seguir practicando, pero se perderá al cerrar esta página.');
    window.addEventListener('circuit-storage-error', saved);
    return () => window.removeEventListener('circuit-storage-error', saved);
  }, []);
  useEffect(() => { if (!saveSession(state)) window.dispatchEvent(new Event('circuit-storage-error')); }, [state]);
  useEffect(() => {
    if (!activeExam || !exam.deadline) return;
    const tick = () => { const timestamp = Date.now(); setNow(timestamp); dispatch({ type: 'tick', now: timestamp }); };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [activeExam, exam?.deadline, dispatch]);
  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => setFullscreen(false));
        setFullscreen(false);
        dispatch({ type: 'clear' });
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'z' || key === 'y') { event.preventDefault(); restoreCircuitFocus.current = true; dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' }); }
        return;
      }
      const rule = getReductionAction(event);
      if (rule && !event.shiftKey) { event.preventDefault(); restoreCircuitFocus.current = true; dispatch({ type: 'reduce', rule }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  useEffect(() => {
    if (!restoreCircuitFocus.current) return;
    restoreCircuitFocus.current = false;
    desk.current?.querySelector('[data-component-id]')?.focus();
  }, [exercise.revision]);
  useEffect(() => {
    const change = () => { const enabled = document.fullscreenElement === desk.current; setNativeFullscreen(enabled); setFullscreen(enabled); if (!enabled) fullscreenButton.current?.focus(); };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [fullscreen]);
  async function toggleFullscreen() {
    if (fullscreen) { if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); setFullscreen(false); fullscreenButton.current?.focus(); return; }
    setFullscreen(true);
    try { await desk.current.requestFullscreen(); } catch { setNativeFullscreen(false); }
  }
  const select = useCallback(id => dispatch({ type: 'select', id }), [dispatch]);
  const clear = useCallback(() => dispatch({ type: 'clear' }), [dispatch]);
  const remaining = exam?.deadline ? Math.max(0, Math.ceil((exam.deadline - now) / 1000)) : null;
  return <main className="practice-app" data-theme={settings.theme}>
    <header className="app-header"><div className="app-identity"><svg viewBox="0 0 44 28" aria-hidden="true"><path d="M 1 14 H 10 L 14 5 L 20 23 L 26 5 L 32 23 L 36 14 H 43" /></svg><div><h1>Circuit Practice</h1><p>Práctica de parciales</p></div></div><div className="header-actions"><button aria-pressed={settings.theme === 'dark'} aria-label={settings.theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} onClick={() => dispatch({ type: 'settings', settings: { theme: settings.theme === 'dark' ? 'light' : 'dark' } })}>{settings.theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}<span>{settings.theme === 'dark' ? 'Claro' : 'Oscuro'}</span></button><button aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Cerrar historial' : 'Historial'}</button></div></header>
    <PracticeSettings settings={settings} activeExam={activeExam} onChange={next => dispatch({ type: 'settings', settings: next })} />
    {storageWarning && <p role="status" className="storage-warning">{storageWarning}</p>}
    {settings.mode === 'exam' && !activeExam && <section className="exam-summary" aria-label="Simulacro de parcial"><div><h2>{exam?.status === 'finished' ? exam.expired ? 'Parcial cerrado' : 'Parcial entregado' : 'Prepará tu parcial'}</h2><p>{exam?.status === 'finished' ? `${exam.results.filter(item => item.status === 'complete').length} de ${exam.count} ejercicios completos. Revisá los pasos y errores al pie de la página.` : `${settings.examCount} ejercicios · ${settings.examMinutes ? settings.examMinutes + ' minutos' : 'Sin límite de tiempo'} · Sin pistas ni fórmulas durante la sesión.`}</p></div><button className="primary" onClick={() => dispatch({ type: 'start-exam' })}>{exam?.status === 'finished' ? 'Comenzar otro parcial' : 'Comenzar parcial'}</button></section>}
    <section ref={desk} className={`workbench ${fullscreen ? 'desk-fullscreen' : ''} ${fullscreen && !nativeFullscreen ? 'css-fullscreen' : ''}`} aria-label="Mesa de trabajo">
      <header className="desk-header"><div className="exercise-heading"><h2>{activeExam ? `Parcial · ${exam.results.length + 1}/${exam.count}` : 'Entrenamiento'} <span>/ {LEVELS[settings.difficulty].label}</span></h2><p>{settings.compType === 'R' ? 'Resistencias' : 'Capacitores'} · {exercise.family}</p></div><div className="telemetry" aria-label="Progreso"><span>Pasos <b data-testid="steps">{steps}</b></span><span>Fallos <b>{mistakes}</b></span><span>Puntos <b data-testid="score">{progress.score}</b></span><span>Racha <b>{progress.streak}</b></span><span className="source-state">Fuente <b>12 V</b></span>{remaining !== null && activeExam && <span aria-label="Tiempo restante" className="exam-clock">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}</div><button ref={fullscreenButton} onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{fullscreen ? 'Salir ⤡' : 'Ampliar ⤢'}</button></header>
      <div className="action-bar" role="group" aria-label="Acciones del circuito"><div className="reduction-actions"><button className="primary" onClick={() => dispatch({ type: 'reduce', rule: 'series' })} disabled={locked || complete || current.selected.length < 2 || !!current.pending}>Serie <kbd>Q</kbd></button><button className="primary" onClick={() => dispatch({ type: 'reduce', rule: 'parallel' })} disabled={locked || complete || current.selected.length < 2 || !!current.pending}>Paralelo <kbd>E</kbd></button>{current.selected.some(id => exercise.edges.find(edge => edge.id === id)?.switchState === 'open') && <button onClick={() => dispatch({ type: 'reduce', rule: 'delete' })} disabled={locked}>Eliminar abierto</button>}<span className="selection-count">{current.selected.length} seleccionados</span></div><div className="secondary-actions"><button onClick={() => dispatch({ type: 'undo' })} disabled={locked || !current.past.length} title="Ctrl/Cmd + Z">Deshacer</button><button onClick={() => dispatch({ type: 'redo' })} disabled={locked || !current.future.length} title="Ctrl/Cmd + Mayús + Z">Rehacer</button>{activeExam ? <button onClick={() => { if (window.confirm('¿Cerrar el parcial? Los ejercicios sin entregar quedarán incompletos.')) dispatch({ type: 'finish-exam' }); }}>Finalizar parcial</button> : <button onClick={() => dispatch({ type: 'new' })}>Nuevo circuito</button>}</div></div>
      <div className="desk-content"><TechnicalCircuit key={exercise.id} exercise={exercise} settings={settings} selected={current.selected} onSelect={select} onClear={clear} disabled={locked || complete || !!current.pending} /><aside className="component-panel" aria-label="Selección de componentes"><div className="panel-heading"><h3>Componentes <span>{exercise.edges.length}</span></h3><button onClick={clear} disabled={!current.selected.length}>Limpiar</button></div><div className="component-list">{exercise.edges.map(edge => <button key={edge.id} className={`component-option ${edge.equivalent ? 'equivalent' : ''}`} data-testid={`component-${edge.id}`} aria-pressed={current.selected.includes(edge.id)} disabled={locked || complete || !!current.pending} onClick={() => select(edge.id)}><span className="component-check" aria-hidden="true">{current.selected.includes(edge.id) ? '✓' : ''}</span><strong>{edge.label}</strong><span className="numeric">{formatExact(edge.value, settings)}</span></button>)}</div><p className="panel-note">Serie y paralelo se reconocen por los nodos, no por la orientación del símbolo.</p>{settings.mode === 'training' && <button className="hint-button" onClick={() => dispatch({ type: 'hint' })}>Pista conceptual</button>}</aside></div>
      {current.pending ? <ArithmeticEntry key={current.pending.revision} pending={current.pending} settings={settings} notice={current.notice} dispatch={dispatch} /> : <div className={`feedback-strip ${current.notice?.kind || ''}`} role="status">{current.notice?.message || 'Elegí dos o más componentes conectados y aplicá una regla.'}</div>}
      {complete && <section className="result-strip" aria-label="Circuito reducido"><div><strong>Equivalente: {formatExact(exercise.edges[0].value, settings)}</strong><p>{current.submitted ? current.rewardEligible === false ? 'Repaso completado; no modifica puntos ni racha.' : 'Resultado registrado. El circuito queda disponible para revisarlo.' : 'Podés deshacer para revisar antes de entregar.'}</p></div>{!current.submitted && <button className="primary" onClick={() => dispatch({ type: 'submit' })}>{activeExam ? 'Entregar y continuar' : 'Entregar resultado'}</button>}{current.submitted && settings.mode !== 'exam' && <button className="primary" onClick={() => dispatch({ type: 'next' })}>Siguiente ejercicio</button>}</section>}
      {settings.mode === 'training' && lastStep && !current.pending && <details className="step-explanation"><summary>Última reducción: fórmula y sustitución</summary><ReductionExplanation step={lastStep} settings={settings} /></details>}
    </section>
    <footer className="practice-footer"><span>Reducción manual · Solo serie y paralelo</span><span>Semilla {exercise.seed} · Mejor racha {progress.bestStreak} · {progress.completed} entregados</span></footer>
    {(showHistory && !activeExam || exam?.status === 'finished') && <PracticeHistory history={state.history} exam={exam} onRepeat={item => { dispatch({ type: 'repeat', item }); setShowHistory(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
  </main>;
}

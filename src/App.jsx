import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import PracticeSettings from './components/PracticeSettings.jsx';
import PracticeHistory from './components/PracticeHistory.jsx';
import TopicPractice from './components/TopicPractice.jsx';
import ProgressPage from './components/ProgressPage.jsx';
import AppNavigation from './components/AppNavigation.jsx';
import AppDialog from './components/AppDialog.jsx';
import PracticeHelp from './components/PracticeHelp.jsx';
import Workbench from './components/Workbench.jsx';
import { ExamCompletionToast } from './components/GameAnimations.jsx';
import { getQaConfig } from './lib/qaConfig.js';
import { loadSession, saveSession } from './lib/session.js';
import { useAnimatedSession } from './lib/useAnimatedSession.js';
import { getReductionAction } from './lib/keyboardShortcuts.js';
import { isComplete, LEVELS } from './lib/exercise.js';
import './App.css';
import './theme.css';
import './refinement.css';
import './animations.css';

function initialize() { return loadSession({ qa: getQaConfig() }); }
export default function App() {
  const [loaded] = useState(initialize);
  const [state, dispatch, feedback, clearFeedback] = useAnimatedSession(loaded.state);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [concentration, setConcentration] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [activeView, setActiveView] = useState(() => loaded.state.topicSession?.phase === 'mini' ? 'topics' : loaded.state.settings.mode === 'exam' ? 'exam' : 'bench');
  const desk = useRef(null), app = useRef(null), restoreCircuitFocus = useRef(false), previousView = useRef(activeView);
  const { settings, current, progress, exam, topicSession, topicProgress } = state;
  const activeExam = exam?.status === 'active';
  const showWorkbench = activeView === 'bench' || (activeView === 'exam' && activeExam);
  const remaining = exam?.deadline ? Math.max(0, Math.ceil((exam.deadline - now) / 1000)) : null;
  const navigate = useCallback(view => { clearFeedback(); setConcentration(false); setActiveView(view); }, [clearFeedback]);
  const exerciseView = settings.mode === 'exam' ? 'exam' : topicSession?.phase === 'mini' ? 'topics' : 'bench';
  const resume = () => navigate(exerciseView);
  const unfinished = topicSession?.phase === 'mini'
    ? topicSession.answered || topicSession.minisInCycle > 0
    : !current.submitted && (Boolean(current.pending) || current.attempts.some(item => item.kind !== 'configuration'));
  const requestChange = run => {
    if (activeExam) return false;
    if (unfinished) {
      setDialog({ title: '¿Dejar esta práctica?', run, message: 'El ejercicio actual quedará registrado como práctica cambiada. Los puntos ya obtenidos se conservan. Podés cancelar para seguir donde estabas.' });
      return false;
    }
    run(); return true;
  };
  function changeSettings(next) {
    if (Object.keys(next).every(key => ['theme', 'flow', 'resistorStyle', 'inductorStyle'].includes(key))) { dispatch({ type: 'settings', settings: next }); return true; }
    return requestChange(() => {
      dispatch({ type: 'settings', settings: next });
      if (next.mode) navigate(next.mode === 'exam' ? 'exam' : 'bench');
    });
  }
  function openView(view) {
    if (activeExam && ['bench', 'topics'].includes(view)) return;
    if (view === 'bench' && (topicSession || settings.mode === 'exam' || settings.topicTopology)) {
      requestChange(() => { dispatch({ type: 'settings', settings: { mode: 'training', focusRule: null, topicTopology: null } }); navigate('bench'); });
    } else if (view === 'exam' && !activeExam && settings.mode !== 'exam') {
      requestChange(() => { dispatch({ type: 'settings', settings: { mode: 'exam', focusRule: null, topicTopology: null } }); navigate('exam'); });
    } else navigate(view);
  }
  useEffect(() => {
    const failed = () => setStorageWarning('El navegador no permite guardar la sesión. Podés seguir practicando, pero se perderá al cerrar esta página.');
    window.addEventListener('circuit-storage-error', failed);
    if (!saveSession(state)) window.dispatchEvent(new Event('circuit-storage-error'));
    return () => window.removeEventListener('circuit-storage-error', failed);
  }, [state]);
  useEffect(() => {
    if (!activeExam || !exam.deadline) return;
    const tick = () => {
      const timestamp = Date.now(); setNow(timestamp); dispatch({ type: 'tick', now: timestamp });
      if (timestamp >= exam.deadline) setDialog(previous => previous?.exam ? null : previous);
    };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [activeExam, exam?.deadline, dispatch]);
  useEffect(() => {
    const onKey = event => {
      if (!showWorkbench || dialog || event.defaultPrevented || event.repeat || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') { dispatch({ type: 'clear' }); return; }
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
  }, [showWorkbench, dialog, dispatch]);
  useEffect(() => {
    if (!restoreCircuitFocus.current || !showWorkbench) return;
    restoreCircuitFocus.current = false;
    desk.current?.querySelector(current.pending ? '#equivalent-answer' : isComplete(current.exercise) ? '.result-strip button' : '[data-component-id][aria-disabled="false"]')?.focus({ preventScroll: true });
  }, [current.exercise.revision, current.pending, showWorkbench, current.exercise]);
  useEffect(() => {
    if (previousView.current === activeView) return;
    previousView.current = activeView;
    const heading = showWorkbench ? desk.current?.querySelector('#equivalent-answer, h2') : app.current?.querySelector('.view-content h2');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }, [activeView, showWorkbench]);
  useLayoutEffect(() => {
    const theme = settings.theme === 'dark' ? 'dark' : 'light';
    const root = document.documentElement;
    root.classList.add('theme-colors-instant'); root.dataset.theme = theme; root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1422' : '#F3F7FC');
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => root.classList.remove('theme-colors-instant')); });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); root.classList.remove('theme-colors-instant'); };
  }, [settings.theme]);

  return <main ref={app} className={`practice-app ${concentration && showWorkbench ? 'is-concentrating' : ''}`} data-theme={settings.theme}>
    <header className="app-header"><div className="app-identity"><svg viewBox="0 0 44 28" aria-hidden="true"><path d="M 1 14 H 10 L 14 5 L 20 23 L 26 5 L 32 23 L 36 14 H 43" /></svg><div><h1>Circuit Practice</h1><p>Práctica de parciales</p></div></div><div className="header-actions"><button aria-pressed={settings.theme === 'dark'} aria-label={settings.theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} onClick={() => changeSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>{settings.theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}<span>{settings.theme === 'dark' ? 'Claro' : 'Oscuro'}</span></button><button onClick={event => { event.currentTarget.focus({ preventScroll: true }); setDialog({ title: 'Cómo practicar', help: true }); }}>Ayuda</button></div></header>
    <AppNavigation activeView={activeView} activeExam={activeExam} onNavigate={openView} />
    {activeExam && <p className="exam-nav-note">El parcial sigue en curso. El reloj continúa al consultar Progreso o Historial.</p>}
    {!showWorkbench && activeView !== exerciseView && <div className="resume-bar"><span>{activeExam ? `Parcial en curso${remaining !== null ? ` · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : ''}` : settings.mode === 'exam' ? 'La configuración y la revisión de tu parcial se conservan.' : topicSession ? 'Tu práctica por tema se conserva.' : 'Tu ejercicio se conserva.'}</span><button onClick={resume}>Volver al ejercicio</button></div>}
    <div hidden={activeView !== 'bench' && activeView !== 'exam'} className="settings-container"><PracticeSettings settings={settings} activeExam={activeExam} topicActive={Boolean(topicSession)} onChange={changeSettings} /></div>
    {storageWarning && <p role="status" className="storage-warning">{storageWarning}</p>}
    <div className="view-content">
      {activeView === 'topics' && <TopicPractice settings={settings} topicSession={topicSession} topicProgress={topicProgress || {}} onStart={topicId => requestChange(() => { dispatch({ type: 'start-topic', topicId }); navigate('topics'); })} onAnswer={answer => dispatch({ type: 'topic-answer', answer })} onContinue={() => { const startsCircuit = topicSession?.minisInCycle >= 2; dispatch({ type: 'continue-topic' }); if (startsCircuit) navigate('bench'); }} onExit={() => requestChange(() => { dispatch({ type: 'exit-topic' }); navigate('topics'); })} onDifficultyChange={difficulty => changeSettings({ difficulty })} onTopologyChange={topicTopology => changeSettings({ topicTopology })} onStyleChange={inductorStyle => changeSettings({ inductorStyle })} onViewCircuit={() => navigate('bench')} />}
      {activeView === 'progress' && <ProgressPage progress={progress} topicProgress={topicProgress || {}} history={state.history} onPractice={activeExam ? undefined : () => openView('topics')} />}
      {activeView === 'history' && <PracticeHistory history={state.history} reviewLocked={activeExam} onPractice={resume} onRepeat={activeExam ? undefined : item => requestChange(() => { dispatch({ type: 'repeat', item }); navigate('bench'); })} />}
      {activeView === 'exam' && settings.mode === 'exam' && !activeExam && <section className="exam-summary" aria-label="Simulacro de parcial"><div><h2>{exam?.status === 'finished' ? exam.expired ? 'Parcial cerrado' : 'Parcial entregado' : 'Prepará tu parcial'}</h2><p>{exam?.status === 'finished' ? `${exam.results.filter(item => item.status === 'complete').length} de ${exam.count} ejercicios completos. Revisá los pasos y errores a continuación.` : `${settings.examCount} ejercicios · ${LEVELS[settings.difficulty].label} · ${settings.compType === 'R' ? 'Resistencias' : settings.compType === 'C' ? 'Capacitores' : 'Inductores'} · ${settings.examMinutes ? settings.examMinutes + ' minutos' : 'Sin límite de tiempo'} · Sin pistas ni fórmulas durante la sesión.`}</p></div><button className="primary" onClick={() => requestChange(() => dispatch({ type: 'start-exam' }))}>{exam?.status === 'finished' ? 'Comenzar otro parcial' : 'Comenzar parcial'}</button></section>}
      {activeView === 'exam' && exam?.status === 'finished' && <PracticeHistory history={state.history} exam={exam} onRepeat={item => requestChange(() => { dispatch({ type: 'repeat', item }); navigate('bench'); })} />}
    </div>
    <Workbench state={state} dispatch={dispatch} feedback={feedback} visible={showWorkbench} deskRef={desk} concentration={concentration} onConcentration={setConcentration} remaining={remaining}
      onNew={() => requestChange(() => dispatch({ type: 'new' }))}
      onFinishExam={() => setDialog({ exam: true, title: '¿Finalizar el parcial?', message: 'Los ejercicios sin entregar quedarán incompletos. Podrás revisar los pasos y errores registrados.', confirmLabel: 'Finalizar parcial', run: () => { dispatch({ type: 'finish-exam' }); navigate('exam'); } })}
      onNext={() => { const continueTopic = topicSession?.phase === 'circuit'; dispatch({ type: 'next' }); if (continueTopic) navigate('topics'); }} />
    <ExamCompletionToast event={feedback.completion} />
    {dialog && <AppDialog title={dialog.title} onCancel={() => setDialog(null)} cancelLabel={dialog.help ? 'Cerrar ayuda' : 'Continuar practicando'} confirmLabel={dialog.confirmLabel} onConfirm={dialog.run ? () => { const run = dialog.run; setDialog(null); run(); } : undefined}>{dialog.help ? <PracticeHelp activeExam={activeExam} /> : <p>{dialog.message}</p>}</AppDialog>}
  </main>;
}

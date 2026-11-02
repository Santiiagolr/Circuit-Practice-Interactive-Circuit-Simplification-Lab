import { formatExact, unitForType } from '../lib/values.js';
import { useMemo, useState } from 'react';
import TechnicalCircuit from './TechnicalCircuit.jsx';
import { reconstructHistory } from '../lib/practiceReview.js';
export function ReductionExplanation({ step, settings }) {
  if (!step) return null;
  if (step.rule === 'delete') return <p>Un interruptor abierto interrumpe la rama. Los componentes sin camino entre A y B dejan de contribuir.</p>;
  const additive = settings.compType === 'C' ? step.rule === 'parallel' : step.rule === 'series', symbol = settings.compType;
  const unit = unitForType(settings);
  const zero = settings.representation === 'symbolic' ? `0${symbol}` : `0 ${unit}`;
  const infinite = settings.representation === 'symbolic' ? `∞${symbol}` : `∞ ${unit}`;
  if (step.equivalent.value.kind === 'wire') return <div className="formula-explanation"><p>{symbol === 'L' ? 'Una inductancia ideal nula equivale a un conductor.' : step.rule === 'parallel' ? 'Un camino conductor ideal en paralelo cortocircuita los terminales.' : 'La cadena formada solo por conductores ideales equivale a un cable.'}</p><p className="numeric">{symbol}eq = {symbol === 'C' ? infinite : zero} → Cable</p></div>;
  if (step.equivalent.value.kind === 'open') return <div className="formula-explanation"><p>{symbol === 'L' ? 'Una rama abierta tiene inductancia equivalente infinita.' : 'Una rama abierta en serie interrumpe el camino eléctrico.'}</p><p className="numeric">{symbol}eq = {symbol === 'C' ? zero : infinite} → Abierto</p></div>;
  const term = item => {
    if (item.value.kind === 'wire') return additive ? zero : '0';
    if (item.value.kind === 'open') return additive ? infinite : '0';
    return additive ? formatExact(item.value, settings) : `1/(${formatExact(item.value, settings)})`;
  };
  return <div className="formula-explanation"><p>{step.rule === 'series' ? 'Serie' : 'Paralelo'}: {additive ? `${symbol}eq = ${symbol}1 + ${symbol}2 + …` : `1/${symbol}eq = 1/${symbol}1 + 1/${symbol}2 + …`}</p><p className="numeric">{additive ? '' : '1 / ('}{step.components.map(term).join(' + ')}{additive ? '' : ')'} = {formatExact(step.equivalent.value, settings)}</p></div>;
}
function AttemptList({ item }) {
  return <ol className="attempt-list">{item.attempts.map((attempt, index) => <li key={index}>{attempt.kind === 'reduction' ? <><span>{attempt.components.map(c => c.label).join(', ')} → {attempt.equivalent?.label || 'Rama eliminada'}</span><ReductionExplanation step={attempt} settings={item.settings} /></> : attempt.kind === 'error' ? <span className="error-text">{attempt.message}{attempt.answer ? ` Respuesta: ${attempt.answer}.` : ''}</span> : ({ undo: 'Deshacer', redo: 'Rehacer', hint: 'Pista consultada', configuration: 'Configuración cambiada' }[attempt.kind] || attempt.kind)}</li>)}</ol>;
}
function ReviewReplay({ item }) {
  const replay = useMemo(() => reconstructHistory(item), [item]);
  const [step, setStep] = useState(0);
  if (!replay.valid) return <p className="review-unavailable" role="status">No se puede reproducir este registro de forma segura. {replay.reason}</p>;
  const frame = replay.frames[Math.min(step, replay.frames.length - 1)];
  const movement = item.attempts.filter(attempt => ['reduction', 'undo', 'redo'].includes(attempt.kind))[step - 1];
  return <details className="review-replay"><summary>Recorrido gráfico paso a paso</summary><div className="review-stage">
    <TechnicalCircuit key={`${item.id}-${step}`} exercise={frame.exercise} settings={frame.exercise.settings} selected={[]} onSelect={() => {}} onClear={() => {}} disabled />
    <p className="review-caption" role="status">Paso {step} de {replay.frames.length - 1} · {frame.description}</p>
    {movement?.kind === 'reduction' && <ReductionExplanation step={movement} settings={item.settings} />}
    <div className="review-controls"><button onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0}>Anterior</button><input type="range" min="0" max={replay.frames.length - 1} value={step} aria-label="Paso de la revisión" onChange={event => setStep(Number(event.target.value))} /><button onClick={() => setStep(value => Math.min(replay.frames.length - 1, value + 1))} disabled={step === replay.frames.length - 1}>Siguiente</button></div>
  </div></details>;
}
function HistoryEntry({ item, onRepeat, reviewLocked }) {
  const [open, setOpen] = useState(false);
  return <details className="history-entry" onToggle={event => setOpen(event.currentTarget.open)}><summary><span>{item.settings?.compType === 'L' ? 'Inductores' : item.settings?.compType === 'C' ? 'Capacitores' : item.settings ? 'Resistencias' : 'Pendiente'} · {item.repeat ? 'Repetición sin puntos' : item.status === 'complete' ? 'Entregado' : item.status === 'incomplete' ? 'Incompleto' : 'Práctica cambiada'}</span><span>{item.errors} errores · {item.steps} pasos · {Math.round(item.elapsed / 1000)} s</span></summary>{open && reviewLocked && <p>La revisión se habilita al finalizar el parcial.</p>}{open && !reviewLocked && item.settings && <div className="history-entry-body">
    <div className="history-result"><p>{item.family} · Semilla {item.seed}{item.settings.compType === 'L' && item.settings.topicTopology ? ` · ${item.settings.topicTopology === 'pure' ? 'Puras' : 'Mixtas'}` : ''}</p><p>Pasos +{item.stepPoints || 0} · Entrega +{item.reward?.points || 0} · Total +{(item.stepPoints || 0) + (item.reward?.points || 0)} · {item.undos} deshacer</p>{item.final?.edges.length === 1 && <p>Equivalente: {formatExact(item.final.edges[0].value, item.settings)}</p>}</div>
    <details><summary>Intentos y explicaciones</summary><AttemptList item={item} /></details>
    {item.initial && item.final && <><ReviewReplay item={item} />{item.status === 'complete' && onRepeat && <button className="repeat-exercise" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onRepeat(item); }}>Repetir sin puntos</button>}</>}
  </div>}</details>;
}

export default function PracticeHistory({ history, exam, onRepeat, onPractice, reviewLocked = false }) {
  const [filters, setFilters] = useState({ component: '', mode: '', status: '' });
  const [page, setPage] = useState(0);
  const entries = exam?.status === 'finished' ? exam.results : history;
  const filtered = [...entries].reverse().filter(item => (!filters.component || item.settings?.compType === filters.component) && (!filters.mode || (item.topicId ? 'topic' : item.settings?.mode) === filters.mode) && (!filters.status || (filters.status === 'repeat' ? item.repeat : item.status === filters.status)));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const change = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(0); };
  return <section className="history-section" aria-label="Historial de ejercicios">
    <h2>{exam?.status === 'finished' ? 'Revisión del parcial' : 'Historial'}</h2><p className="muted">{reviewLocked ? 'Durante el parcial podés consultar los registros. La revisión se habilita al finalizar el parcial.' : 'Revisá tus decisiones o repetí un circuito sin sumar puntos.'}</p>
    <div className="history-filters"><label className="setting"><span>Componente del historial</span><select value={filters.component} onChange={event => change('component', event.target.value)}><option value="">Todos los componentes</option><option value="R">Resistencias</option><option value="C">Capacitores</option><option value="L">Inductores</option></select></label><label className="setting"><span>Modalidad del historial</span><select value={filters.mode} onChange={event => change('mode', event.target.value)}><option value="">Todas las modalidades</option><option value="training">Práctica libre</option><option value="topic">Por temas</option><option value="exam">Parcial</option></select></label><label className="setting"><span>Estado del historial</span><select value={filters.status} onChange={event => change('status', event.target.value)}><option value="">Todos los estados</option><option value="complete">Entregados</option><option value="abandoned">Práctica cambiada</option><option value="incomplete">Incompletos</option><option value="repeat">Repeticiones sin puntos</option></select></label></div>
    {!filtered.length && <div className="empty-state"><h3>{entries.length ? 'No hay registros con estos filtros' : 'Todavía no hay ejercicios registrados'}</h3><p>{entries.length ? 'Cambiá los filtros para ver otros ejercicios.' : 'Entregá un circuito para revisar acá tus pasos y el resultado.'}</p>{entries.length ? <button onClick={() => { setFilters({ component: '', mode: '', status: '' }); setPage(0); }}>Limpiar filtros</button> : onPractice && <button className="primary" onClick={onPractice}>Ir a practicar</button>}</div>}
    {filtered.slice(currentPage * 20, currentPage * 20 + 20).map((item, index) => <HistoryEntry key={`${item.id}-${currentPage}-${index}`} item={item} onRepeat={onRepeat} reviewLocked={reviewLocked} />)}
    {filtered.length > 0 && <nav className="history-pagination" aria-label="Páginas del historial"><button aria-label="Página anterior" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><p role="status">Página {currentPage + 1} de {pages} · {filtered.length} registros</p><button aria-label="Página siguiente" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Siguiente</button></nav>}
  </section>;
}

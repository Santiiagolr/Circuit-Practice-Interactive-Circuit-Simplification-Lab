import { formatExact } from '../lib/values.js';
export function ReductionExplanation({ step, settings }) {
  if (!step) return null;
  if (step.rule === 'delete') return <p>Un interruptor abierto interrumpe la rama. Los componentes sin camino entre A y B dejan de contribuir.</p>;
  const additive = (settings.compType === 'R') === (step.rule === 'series'), symbol = settings.compType;
  return <div className="formula-explanation"><p>{step.rule === 'series' ? 'Serie' : 'Paralelo'}: {additive ? `${symbol}eq = ${symbol}1 + ${symbol}2 + …` : `1/${symbol}eq = 1/${symbol}1 + 1/${symbol}2 + …`}</p><p className="numeric">{additive ? '' : '1 / ('}{step.components.map(item => `${additive ? '' : '1/('}${formatExact(item.value, settings)}${additive ? '' : ')'}`).join(' + ')}{additive ? '' : ')'} = {formatExact(step.equivalent.value, settings)}</p></div>;
}
function AttemptList({ item }) {
  return <ol className="attempt-list">{item.attempts.map((attempt, index) => <li key={index}>{attempt.kind === 'reduction' ? <><span>{attempt.components.map(c => c.label).join(', ')} → {attempt.equivalent?.label || 'Rama eliminada'}</span><ReductionExplanation step={attempt} settings={item.settings} /></> : attempt.kind === 'error' ? <span className="error-text">{attempt.message}{attempt.answer ? ` Respuesta: ${attempt.answer}.` : ''}</span> : ({ undo: 'Deshacer', redo: 'Rehacer', hint: 'Pista consultada', configuration: 'Configuración cambiada' }[attempt.kind] || attempt.kind)}</li>)}</ol>;
}
export default function PracticeHistory({ history, exam }) {
  const entries = exam?.status === 'finished' ? exam.results : history;
  return <section className="history-section" aria-label="Historial de ejercicios"><h2>{exam?.status === 'finished' ? 'Revisión del parcial' : 'Historial'}</h2>{!entries.length && <p>Los ejercicios entregados y los cambios de práctica aparecerán acá.</p>}{[...entries].reverse().map((item, index) => <details key={`${item.id}-${index}`} className="history-entry"><summary><span>{item.settings?.compType === 'C' ? 'Capacitores' : item.settings ? 'Resistencias' : 'Pendiente'} · {item.status === 'complete' ? 'Entregado' : item.status === 'incomplete' ? 'Incompleto' : 'Práctica cambiada'}</span><span>{item.errors} errores · {item.steps} pasos · {item.undos} deshacer · {Math.round(item.elapsed / 1000)} s {item.reward ? `· +${item.reward.points} puntos` : ''}</span></summary>{item.settings && <><p className="muted">{item.family} · Semilla {item.seed}</p>{item.final?.edges.length === 1 && <p>Equivalente: {formatExact(item.final.edges[0].value, item.settings)}</p>}<AttemptList item={item} /></>}</details>)}</section>;
}

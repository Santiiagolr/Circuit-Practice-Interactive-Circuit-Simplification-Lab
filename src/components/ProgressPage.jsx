import { TOPICS } from '../lib/topicPractice.js';

export default function ProgressPage({ progress, topicProgress = {}, history = [], onPractice }) {
  const delivered = history.filter(item => item.status === 'complete' && !item.repeat);
  const repeats = history.filter(item => item.status === 'complete' && item.repeat).length;
  const nonTopic = delivered.filter(item => !item.topicId && item.settings?.mode === 'training');
  const topicCircuits = Object.values(topicProgress).reduce((total, stats) => total + (stats.circuits || 0), 0);
  return <section className="progress-page" aria-label="Progreso de aprendizaje">
    <p className="eyebrow">Tu recorrido</p><h2>Progreso de práctica</h2><p className="progress-intro">Los minis y circuitos se cuentan por separado. Esta pantalla muestra actividad registrada; no convierte una racha o un puntaje en una medida de dominio.</p>
    <div className="progress-cards"><div className="progress-card"><span>Circuitos entregados</span><strong>{progress.completed}</strong></div><div className="progress-card"><span>Circuitos por tema</span><strong>{topicCircuits}</strong></div><div className="progress-card"><span>Práctica libre en historial</span><strong>{nonTopic.length}</strong></div><div className="progress-card"><span>Repeticiones en historial</span><strong>{repeats}</strong></div></div>
    {!progress.completed && onPractice && <div className="empty-state"><h3>Tu recorrido empieza con un circuito</h3><p>Elegí un tema, practicá sus conexiones y entregá el circuito completo.</p><button className="primary" onClick={onPractice}>Elegir un tema</button></div>}
    <h3>Actividad por tema</h3><div className="progress-topics">{TOPICS.map(topic => {
      const stats = topicProgress[topic.id] || {};
      const freeCircuits = nonTopic.filter(item => item.settings?.compType === topic.compType && item.attempts?.some(attempt => attempt.kind === 'reduction' && attempt.rule === topic.rule));
      const freeSteps = freeCircuits.reduce((total, item) => total + item.attempts.filter(attempt => attempt.kind === 'reduction' && attempt.rule === topic.rule).length, 0);
      const minis = stats.minis || 0, correct = stats.miniCorrect || 0;
      const circuits = stats.circuits || 0;
      return <article className="progress-topic" key={topic.id}><h3>{topic.title}</h3><progress max={Math.max(1, minis)} value={correct} aria-label={`${topic.title}: ${correct} minis correctos de ${minis}`} /><p>{minis ? `${correct} de ${minis} mini ejercicios correctos` : 'Todavía no hay mini ejercicios registrados'} · {circuits} {circuits === 1 ? 'circuito' : 'circuitos'} del tema · {freeSteps} reducciones del mismo tipo en práctica libre · {(stats.miniErrors || 0) + (stats.circuitErrors || 0)} errores del tema</p>{topic.compType === 'L' && <p>La actividad Puras/Mixtas se conserva en el historial de cada circuito.</p>}</article>;
    })}</div><p className="muted progress-history-note">La práctica libre y las repeticiones muestran los registros disponibles en el historial. Los parciales se revisan por separado.</p>
    <details className="progress-rewards"><summary>Puntos y rachas</summary><div className="progress-cards"><div className="progress-card"><span>Puntos</span><strong>{progress.score}</strong></div><div className="progress-card"><span>Racha de pasos</span><strong>{progress.stepStreak || 0}</strong></div><div className="progress-card"><span>Mejor racha de pasos</span><strong>{progress.bestStepStreak || 0}</strong></div><div className="progress-card"><span>Racha de circuitos</span><strong>{progress.streak}</strong></div><div className="progress-card"><span>Mejor racha de circuitos</span><strong>{progress.bestStreak}</strong></div></div></details>
  </section>;
}

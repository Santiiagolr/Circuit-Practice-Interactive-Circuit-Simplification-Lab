import { TOPICS } from '../lib/topicPractice.js';

export default function ProgressPage({ progress, topicProgress = {}, history = [] }) {
  const delivered = history.filter(item => item.status === 'complete' && !item.repeat);
  const repeats = history.filter(item => item.status === 'complete' && item.repeat).length;
  const nonTopic = delivered.filter(item => !item.topicId);
  return <section className="progress-page" aria-label="Progreso de aprendizaje">
    <p className="eyebrow">Tu recorrido</p><h2>Progreso de práctica</h2><p className="progress-intro">Los minis y circuitos se cuentan por separado. Esta pantalla muestra actividad registrada; no convierte una racha o un puntaje en una medida de dominio.</p>
    <div className="progress-cards"><div className="progress-card"><span>Puntos</span><strong>{progress.score}</strong></div><div className="progress-card"><span>Racha actual</span><strong>{progress.streak}</strong></div><div className="progress-card"><span>Mejor racha</span><strong>{progress.bestStreak}</strong></div><div className="progress-card"><span>Circuitos entregados</span><strong>{progress.completed}</strong></div><div className="progress-card"><span>Repeticiones sin puntos</span><strong>{repeats}</strong></div></div>
    <h3>Actividad por tema</h3><div className="progress-topics">{TOPICS.map(topic => {
      const stats = topicProgress[topic.id] || {};
      const freeCircuits = nonTopic.filter(item => item.settings?.compType === topic.compType && item.attempts?.some(attempt => attempt.kind === 'reduction' && attempt.rule === topic.rule));
      const freeSteps = freeCircuits.reduce((total, item) => total + item.attempts.filter(attempt => attempt.kind === 'reduction' && attempt.rule === topic.rule).length, 0);
      const minis = stats.minis || 0, correct = stats.miniCorrect || 0;
      const circuits = stats.circuits || 0;
      return <article className="progress-topic" key={topic.id}><h3>{topic.title}</h3><progress max={Math.max(1, minis)} value={correct} aria-label={`${topic.title}: ${correct} minis correctos de ${minis}`} /><p>{minis ? `${correct} de ${minis} mini ejercicios correctos` : 'Todavía no hay mini ejercicios registrados'} · {circuits} {circuits === 1 ? 'circuito' : 'circuitos'} del tema · {freeSteps} reducciones del mismo tipo en práctica libre · {(stats.miniErrors || 0) + (stats.circuitErrors || 0)} errores del tema</p></article>;
    })}</div>
  </section>;
}

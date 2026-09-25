import { useMemo } from 'react';
import { LEVELS } from '../lib/exercise.js';
import { createMiniExercise, TOPICS } from '../lib/topicPractice.js';
import MiniCircuitDiagram from './MiniCircuitDiagram.jsx';

function TopicStats({ progress = {} }) {
  return <p className="topic-stats">Minis: {progress.miniCorrect || 0}/{progress.minis || 0} correctos · Circuitos: {progress.circuits || 0} · Errores: {(progress.miniErrors || 0) + (progress.circuitErrors || 0)}</p>;
}

export default function TopicPractice({ settings, topicSession, topicProgress, onStart, onAnswer, onContinue, onExit, onDifficultyChange, onViewCircuit }) {
  const activeTopic = TOPICS.find(topic => topic.id === topicSession?.topicId);
  const mini = useMemo(() => topicSession?.phase === 'mini' ? createMiniExercise(topicSession.topicId, topicSession.seed, topicSession.miniIndex, settings) : null, [topicSession, settings]);
  return <section className="topics-page" aria-label="Práctica por temas">
    <header className="topics-heading"><div><p className="eyebrow">Entrenamiento dirigido</p><h2>{activeTopic ? activeTopic.title : 'Elegí un tema para practicar'}</h2><p>Dos diagnósticos breves y un circuito completo, en un ciclo continuo. Los minis no suman puntos; un error reinicia la racha.</p></div><label className="topic-difficulty">Dificultad<select value={settings.difficulty} onChange={event => onDifficultyChange(event.target.value)}>{Object.entries(LEVELS).map(([key, level]) => <option key={key} value={key}>{level.label} · {level.min}–{level.max} elementos</option>)}</select></label></header>
    {topicSession?.phase === 'circuit' && activeTopic && <div className="topic-next-circuit" role="status"><div><strong>Los dos minis están listos.</strong><p>Ahora resolvé manualmente un circuito completo con una combinación principal en {activeTopic.rule === 'series' ? 'serie' : 'paralelo'}. El dibujo ya está preparado en la mesa.</p></div><button className="primary" onClick={onViewCircuit}>Ir al circuito</button><button onClick={onExit}>Salir del tema</button></div>}
    {topicSession?.phase === 'mini' && activeTopic && mini && <>
      <div className="topic-cycle-progress" aria-label={`Mini ejercicio ${topicSession.minisInCycle + 1} de 2`}><span className={topicSession.minisInCycle >= 1 ? 'done' : 'current'}>Mini 1</span><i /><span className={topicSession.minisInCycle >= 2 ? 'done' : topicSession.minisInCycle === 1 ? 'current' : ''}>Mini 2</span><i /><span>Circuito completo</span></div>
      <article className="mini-card"><div className="mini-card-heading"><div><p className="eyebrow">Diagnóstico {topicSession.minisInCycle + 1} / 2</p><h3>Observá los nodos, no la forma del dibujo</h3></div><TopicStats progress={topicProgress[activeTopic.id]} /></div>
        <MiniCircuitDiagram mini={mini} />
        <div className="mini-question"><h4>¿Los dos componentes destacados están en {activeTopic.rule === 'series' ? 'serie' : 'paralelo'}?</h4>{!topicSession.answered ? <div className="mini-answers"><button onClick={() => onAnswer('yes')}>Sí, cumplen la regla</button><button onClick={() => onAnswer('no')}>No, hay otra conexión</button></div> : <div className={`mini-feedback ${topicSession.lastCorrect ? 'correct' : 'incorrect'}`} role="status"><strong>{topicSession.lastCorrect ? 'Correcto.' : 'Revisemos esa conexión.'}</strong><p>{mini.explanation}</p><button className="primary" onClick={onContinue}>{topicSession.minisInCycle < 2 ? 'Siguiente mini ejercicio' : 'Continuar al circuito completo'}</button></div>}</div>
      </article>
      <div className="topic-footer"><TopicStats progress={topicProgress[activeTopic.id]} /><button onClick={onExit}>Salir de la práctica por tema</button></div>
    </>}
    {!activeTopic && <div className="topic-grid">{TOPICS.map(topic => <article className="topic-card" key={topic.id}><div className="topic-card-symbol" aria-hidden="true">{topic.compType === 'R' ? 'R' : 'C'}<span>{topic.rule === 'series' ? '—' : '∥'}</span></div><div><h3>{topic.title}</h3><p>{topic.rule === 'series' ? 'Revisá cada nodo intermedio: no debe existir una derivación.' : 'Compará los dos nodos extremos de cada componente.'}</p><TopicStats progress={topicProgress[topic.id]} /></div><button className="primary" onClick={() => onStart(topic.id)}>Empezar tema</button></article>)}</div>}
  </section>;
}

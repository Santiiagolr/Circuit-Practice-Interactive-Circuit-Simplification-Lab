import { useEffect, useRef, useState } from 'react';
import { formatExact } from '../lib/values.js';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = event => setReduced(event.matches);
    setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export function ScoreFeedback({ value, event = null }) {
  const reduced = useReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const displayedRef = useRef(value), floatRef = useRef(null);

  useEffect(() => {
    if (!event?.id) {
      displayedRef.current = value;
      setDisplayed(value);
      return undefined;
    }
    if (reduced) {
      displayedRef.current = value;
      setDisplayed(value);
      return undefined;
    }
    let frame = 0, start = null;
    const from = displayedRef.current, duration = Math.max(1, event.duration || 500);
    const tick = timestamp => {
      start ??= timestamp;
      const progress = Math.min(1, (timestamp - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(from + (value - from) * eased);
      displayedRef.current = current;
      setDisplayed(current);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { displayedRef.current = value; setDisplayed(value); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, event?.id, event?.duration, reduced]);

  useEffect(() => {
    const node = floatRef.current;
    if (!node || !event?.id || !event.amount || reduced || typeof node.animate !== 'function') return undefined;
    const animation = node.animate([
      { opacity: 0, transform: 'translate(-50%, 18px)' },
      { opacity: 1, transform: 'translate(-50%, 7px)', offset: 0.16 },
      { opacity: 1, transform: 'translate(-50%, -13px)', offset: 0.6 },
      { opacity: 0, transform: 'translate(-50%, -18px)' },
    ], { duration: event.duration || 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'none' });
    return () => animation.cancel();
  }, [event?.id, event?.amount, event?.duration, reduced]);

  return <span className="score-feedback" role="group" aria-label={`Puntos: ${value}`}>
    <span className="score-feedback__visual" aria-hidden="true">{displayed}</span>
    <b className="visually-hidden" data-testid="score">{value}</b>
    {event?.amount > 0 && <span ref={floatRef} className={`score-feedback__gain ${event.color === 'delivery' ? 'is-delivery' : 'is-step'}`} aria-hidden="true">+{event.amount}</span>}
  </span>;
}

export function StepStreakIndicator({ value = 0, event = null }) {
  const milestone = event?.type === 'increment' && event.milestone && event.value === value;
  const resetting = event?.type === 'reset' && value === 0;
  const eventId = event?.id || 'idle';
  return <span className={`step-streak-indicator ${milestone ? 'is-milestone' : ''} ${resetting ? 'is-reset' : ''}`} aria-label={`${value} reducciones correctas consecutivas`} data-testid="step-streak">
    <span className="step-streak-indicator__label">Racha de pasos</span>
    <b key={`count-${eventId}`} className="step-streak-indicator__count">{value}</b>
    <span className="streak-segments" aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} className={`streak-segment ${index < Math.min(value, 10) ? 'is-filled' : ''} ${event?.type === 'increment' && index === value - 1 ? 'is-new' : ''}`} />)}</span>
    {milestone && <span key={`rays-${eventId}`} className="streak-milestone-rays" aria-hidden="true"><i /><i /><i /><i /></span>}
  </span>;
}

function particlesFor(id = '') {
  let hash = 17;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 10 }, (_, index) => {
    const angle = (index * 137.5 + hash % 31) * Math.PI / 180;
    const distance = 18 + ((hash >>> (index % 16)) + index * 7) % 27;
    const fall = 4 + (index * 5 + hash % 9) % 9;
    return {
      x: Math.round(Math.cos(angle) * distance),
      y: Math.round(Math.sin(angle) * distance + fall),
      rotate: index % 2 ? 45 : 0,
      kind: index % 3 === 0 ? 'diamond' : 'circle',
      color: index % 2 ? 'is-select' : 'is-equivalent',
    };
  });
}

export function CompletionPresentation({ event, compact = false }) {
  const reduced = useReducedMotion();
  const contentRef = useRef(null), checkRef = useRef(null), circleRef = useRef(null);
  const repeat = event?.repeat === true;
  const equivalent = event?.equivalent && event?.settings ? formatExact(event.equivalent, event.settings) : '—';
  const errors = Math.max(0, event?.errors || 0);
  useEffect(() => {
    if (!event?.id || repeat || reduced || typeof Element === 'undefined') return undefined;
    const animations = [];
    const content = contentRef.current, check = checkRef.current, circle = circleRef.current;
    if (content?.animate) animations.push(content.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    ));
    if (check?.animate) animations.push(check.animate(
      [{ strokeDashoffset: 22 }, { strokeDashoffset: 0 }],
      { duration: 180, delay: 80, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' },
    ));
    if (circle?.animate) animations.push(circle.animate(
      [{ transform: 'scale(0.96)' }, { transform: 'scale(1.03)', offset: 0.52 }, { transform: 'scale(1)' }],
      { duration: 180, delay: 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
    ));
    return () => animations.forEach(animation => animation.cancel());
  }, [event?.id, repeat, reduced]);

  return <div ref={contentRef} className={`completion-presentation ${compact ? 'is-compact' : ''} ${repeat ? 'is-repeat' : ''} ${reduced ? 'is-static' : ''}`} data-testid="completion">
    <span className="completion-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" focusable="false"><circle ref={circleRef} cx="18" cy="18" r="15" /><path ref={checkRef} d="m10.5 18.3 5 5 10-11" /></svg>
    </span>
    <span className="completion-copy"><strong>{repeat ? 'Repaso completado' : '¡Circuito resuelto!'}</strong>
      {!repeat && <><span className="completion-copy__detail">Equivalente: {equivalent} · {errors} {errors === 1 ? 'error' : 'errores'}</span>
        <span className="completion-copy__reward">Puntos de pasos: +{event?.stepPoints || 0} · entrega: +{event?.rewardPoints || 0} · total: +{(event?.stepPoints || 0) + (event?.rewardPoints || 0)}</span></>}
    </span>
    {!repeat && !reduced && <span className="completion-particles" aria-hidden="true">{particlesFor(event?.id).map((particle, index) => <i key={index} className={`completion-particle ${particle.kind} ${particle.color}`} style={{ '--particle-x': `${particle.x}px`, '--particle-y': `${particle.y}px`, '--particle-rotate': `${particle.rotate}deg`, '--particle-delay': `${180 + index * 3}ms` }} />)}</span>}
  </div>;
}

export function ExamCompletionToast({ event }) {
  if (!event || event.source !== 'exam') return null;
  return <aside className="exam-completion-toast" role="status" aria-live="polite" aria-atomic="true" key={event.id}>
    <CompletionPresentation event={event} compact />
    {!event.repeat && <span className="exam-toast-progress">Racha de pasos: {event.stepStreak} · Pasos +{event.stepPoints} · Entrega +{event.rewardPoints}</span>}
  </aside>;
}

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { sessionReducer } from './session.js';
import { describeAnimationTransition } from './animationEvents.js';

const emptyFeedback = () => ({ geometry: null, score: null, streak: null, completion: null });
const fullCancellation = new Set(['settings', 'new', 'next', 'repeat', 'start-topic', 'exit-topic', 'continue-topic', 'start-exam', 'finish-exam']);
const geometryCancellation = new Set(['select', 'clear', 'undo', 'redo', 'reduce', 'answer']);

function scoreEvent(previous, event, amount, color, now, delay = 0) {
  if (!amount) return previous;
  const active = previous && previous.expiresAt > now;
  const duration = active ? 320 : 500;
  return { id: event.id, amount: amount + (active ? previous.amount : 0), color, duration, delay: active ? 0 : delay, expiresAt: now + duration + (active ? 0 : delay) };
}

export function animatedSessionReducer(wrapper, action) {
  if (action.type === 'feedback-clear') return { ...wrapper, feedback: emptyFeedback() };
  if (action.type === 'feedback-motion-change') return { ...wrapper, feedback: { geometry: null, streak: null, score: wrapper.feedback.score && { ...wrapper.feedback.score, motionDisabled: true }, completion: wrapper.feedback.completion && { ...wrapper.feedback.completion, motionDisabled: true } } };
  if (action.type === 'feedback-expire') {
    if (wrapper.feedback[action.channel]?.id !== action.id) return wrapper;
    return { ...wrapper, feedback: { ...wrapper.feedback, [action.channel]: null } };
  }
  const session = sessionReducer(wrapper.session, action);
  if (session === wrapper.session) return wrapper;
  const event = describeAnimationTransition(wrapper.session, action, session, action.eventId);
  let feedback = wrapper.feedback;
  const now = action.now;
  if (event?.type === 'reduction') {
    const increased = event.stepStreakAfter > event.stepStreakBefore;
    const count = event.stepStreakAfter;
    feedback = {
      ...feedback,
      geometry: { ...event, expiresAt: now + (event.rule === 'delete' ? 160 : 320) },
      score: scoreEvent(feedback.score, event, event.stepPoints, 'step', now, 120),
      streak: increased ? { id: event.id, type: 'increment', value: count, beforeValue: event.stepStreakBefore, milestone: [3, 5, 10].includes(count) || count > 10 && count % 10 === 0, delay: 220, expiresAt: now + 620 } : feedback.streak,
    };
  } else if (event?.type === 'completion') {
    feedback = { ...feedback, geometry: null, completion: { ...event, expiresAt: now + 1760 }, score: scoreEvent(feedback.score, event, event.rewardPoints, 'delivery', now) };
  } else if (fullCancellation.has(action.type) || wrapper.session.exam?.status === 'active' && session.exam?.status === 'finished') {
    feedback = emptyFeedback();
  } else if (geometryCancellation.has(action.type)) {
    feedback = { ...feedback, geometry: null };
  }
  if (session.progress.stepStreak < wrapper.session.progress.stepStreak) {
    feedback = { ...feedback, streak: { id: action.eventId, type: 'reset', value: 0, delay: 0, expiresAt: now + 120 } };
  }
  return { session, feedback };
}

export function useAnimatedSession(initialSession) {
  const [wrapper, rawDispatch] = useReducer(animatedSessionReducer, initialSession, session => ({ session, feedback: emptyFeedback() }));
  const sequence = useRef(0);
  const dispatch = useCallback(action => rawDispatch({ ...action, now: action.now ?? Date.now(), eventId: `action-${++sequence.current}` }), []);
  const clearFeedback = useCallback(() => rawDispatch({ type: 'feedback-clear' }), []);
  useEffect(() => {
    const timers = Object.entries(wrapper.feedback).flatMap(([channel, event]) => event ? [setTimeout(() => rawDispatch({ type: 'feedback-expire', channel, id: event.id }), Math.max(0, event.expiresAt - Date.now()))] : []);
    return () => timers.forEach(clearTimeout);
  }, [wrapper.feedback]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) clearFeedback(); };
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motionChanged = () => rawDispatch({ type: 'feedback-motion-change' });
    document.addEventListener('visibilitychange', hidden);
    query?.addEventListener?.('change', motionChanged);
    return () => { document.removeEventListener('visibilitychange', hidden); query?.removeEventListener?.('change', motionChanged); };
  }, [clearFeedback]);
  return [wrapper.session, dispatch, wrapper.feedback, clearFeedback];
}

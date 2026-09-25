import { generateExercise, normalizeSettings, isComplete, inspectExercise, prepareReduction, reduceExercise } from './exercise.js';
import { normalizeProgress, calculateReward, applyReward, PROGRESS_KEY } from './gameState.js';
import { isExactValue, parseAnswer, answersMatch } from './values.js';
import { createMiniExercise, createTopicProgress, TOPICS, validateTopicProgress, validateTopicSession } from './topicPractice.js';

export const SESSION_KEY = 'circuit-practice:session:v2';
const currentExercise = (exercise, now, rewardEligible = true) => ({ exercise, startedAt: now, selected: [], past: [], future: [], attempts: [], pending: null, notice: null, submitted: false, rewardEligible });
const recentKey = settings => settings.focusRule ? `${settings.difficulty}:${settings.compType}:${settings.focusRule}` : settings.difficulty;
function spawn(state, seed, now) {
  const key = recentKey(state.settings), recent = state.recent[key] || (state.settings.focusRule ? [] : state.recent[state.settings.difficulty] || []);
  const exercise = generateExercise(state.settings, seed, recent, state.settings.focusRule);
  return { ...state, recent: { ...state.recent, [key]: [...recent, exercise.signature].slice(-20) }, current: currentExercise(exercise, now) };
}
export function createSession({ settings, progress, seed = Date.now(), qaKey = null, now = Date.now() } = {}) {
  return spawn({ version: 2, settings: normalizeSettings(settings), progress: normalizeProgress(progress), topicProgress: createTopicProgress(), topicSession: null, recent: {}, history: [], exam: null, qaKey }, seed, now);
}
function record(state, event, now) {
  return { ...state, current: { ...state.current, attempts: [...state.current.attempts, { ...event, at: now }].slice(-1000) } };
}
function report(state, message, kind = 'info') {
  return { ...state, current: { ...state.current, notice: { message, kind } } };
}
function wrong(state, message, now, detail) {
  const next = record(state, { kind: 'error', message, ...detail }, now);
  const topicSession = state.topicSession?.phase === 'circuit' ? state.topicSession : null;
  const topicProgress = topicSession ? { ...state.topicProgress, [topicSession.topicId]: { ...state.topicProgress[topicSession.topicId], circuitErrors: state.topicProgress[topicSession.topicId].circuitErrors + 1 } } : state.topicProgress;
  return report({ ...next, progress: { ...next.progress, streak: 0 }, topicProgress }, state.exam?.status === 'active' ? 'Respuesta incorrecta. Podés reintentar.' : message, 'error');
}
function commit(state, ids, rule, now) {
  const result = reduceExercise(state.current.exercise, ids, rule);
  if (!result.valid) return report(state, result.message, result.status === 'fault' ? 'error' : 'warning');
  const next = record(state, { kind: 'reduction', rule, components: result.selected.map(edge => ({ id: edge.id, label: edge.label, value: edge.value })), equivalent: result.equivalent && { label: result.equivalent.label, value: result.equivalent.value } }, now);
  return { ...next, current: { ...next.current, exercise: result.exercise, past: [...next.current.past, state.current.exercise], future: [], selected: [], pending: null, notice: { kind: 'success', message: isComplete(result.exercise) ? 'Circuito reducido. Revisá el resultado y entregá cuando estés listo.' : rule === 'delete' ? 'Interruptor abierto eliminado; ramas desconectadas podadas.' : 'Reducción confirmada.' } } };
}
function resultRecord(state, now, status, reward = null) {
  const { exercise, attempts, startedAt } = state.current;
  return { id: exercise.id, seed: exercise.seed, settings: exercise.settings, family: exercise.family, topicId: state.topicSession?.phase === 'circuit' ? state.topicSession.topicId : null, initial: state.current.past[0] || exercise, final: exercise, attempts, status, reward, repeat: !state.current.rewardEligible,
    steps: attempts.filter(item => item.kind === 'reduction').length, errors: attempts.filter(item => item.kind === 'error').length, undos: attempts.filter(item => item.kind === 'undo').length, elapsed: Math.max(0, now - startedAt) };
}
function historyWithAbandoned(state, now) {
  // Topic mini rounds do not own current.exercise. That exercise was already
  // archived on entry, so leaving or switching topics must not archive it twice.
  if (state.current.submitted || state.topicSession?.phase === 'mini') return state.history;
  return [...state.history, resultRecord(state, now, 'abandoned')].slice(-200);
}
function expire(state, now) {
  if (state.exam?.status !== 'active' || !state.exam.deadline || now < state.exam.deadline) return state;
  const item = resultRecord(state, state.exam.deadline, 'incomplete');
  const results = [...state.exam.results, item];
  while (results.length < state.exam.count) results.push({ id: `pending-${results.length}`, status: 'incomplete', steps: 0, errors: 0, undos: 0, elapsed: 0, attempts: [] });
  return { ...state, history: [...state.history, item].slice(-200), exam: { ...state.exam, status: 'finished', expired: true, results }, current: { ...state.current, pending: null, selected: [], submitted: true } };
}
export function sessionReducer(state, action) {
  const now = action.now ?? Date.now();
  const fresh = expire(state, now);
  if (fresh !== state) return fresh;
  const current = state.current;
  const seed = action.seed ?? Number(current.exercise.seed) + 1;
  const locked = current.submitted || (state.settings.mode === 'exam' && state.exam?.status !== 'active');
  switch (action.type) {
    case 'tick': return state;
    case 'select':
      if (locked || current.pending || isComplete(current.exercise)) return state;
      if (!current.exercise.edges.some(edge => edge.id === action.id)) return state;
      return { ...state, current: { ...current, notice: null, selected: current.selected.includes(action.id) ? current.selected.filter(id => id !== action.id) : [...current.selected, action.id] } };
    case 'clear': return { ...state, current: { ...current, selected: [], pending: null } };
    case 'reduce': {
      if (locked || current.pending || isComplete(current.exercise)) return state;
      const check = prepareReduction(current.exercise, current.selected, action.rule);
      if (!check.valid) return check.status === 'invalid'
        ? wrong(state, check.message, now, { rule: action.rule, ids: current.selected })
        : report(state, check.message, check.status === 'fault' ? 'error' : 'warning');
      if (state.settings.manual && action.rule !== 'delete') return { ...state, current: { ...current, pending: { ids: [...current.selected], rule: action.rule, revision: current.exercise.revision, value: check.value }, notice: null } };
      return commit(state, current.selected, action.rule, now);
    }
    case 'answer': {
      if (locked || !current.pending) return state;
      if (current.pending.revision !== current.exercise.revision) return { ...state, current: { ...current, pending: null } };
      let answer;
      try { answer = parseAnswer(action.text, state.settings); } catch (error) { return report(state, error.message, 'warning'); }
      if (!answersMatch(answer, current.pending.value, state.settings)) return wrong(state, 'El valor no coincide. Revisá la fórmula, las unidades y el redondeo a tres cifras significativas.', now, { rule: current.pending.rule, answer: action.text, expected: current.pending.value });
      return commit(state, current.pending.ids, current.pending.rule, now);
    }
    case 'undo':
    case 'redo': {
      const undo = action.type === 'undo', list = undo ? current.past : current.future;
      if (locked || !list.length) return state;
      const candidate = list.at(-1), integrity = inspectExercise(candidate);
      if (!integrity.valid) return report(state, 'No se restauró el paso porque el circuito guardado no superó la verificación eléctrica y visual.', 'error');
      const next = record(state, { kind: action.type }, now);
      return { ...next, current: { ...next.current, exercise: candidate, past: undo ? current.past.slice(0, -1) : [...current.past, current.exercise], future: undo ? [...current.future, current.exercise] : current.future.slice(0, -1), selected: [], pending: null, notice: { kind: 'info', message: undo ? 'Paso deshecho. Los intentos y errores se conservan.' : 'Paso rehecho.' } } };
    }
    case 'hint': {
      if (locked || state.settings.mode !== 'training') return state;
      const next = record(state, { kind: 'hint' }, now);
      const selected = current.selected.map(id => current.exercise.edges.find(edge => edge.id === id));
      const message = selected.length ? 'Seguí los terminales de tu selección. Dos terminales comunes indican paralelo; un nodo intermedio sin derivaciones permite serie. La orientación del dibujo no cambia la conexión.' : 'Buscá nodos, no formas. En serie, el nodo compartido tiene solo dos conexiones. En paralelo, las ramas comparten ambos extremos.';
      return report(next, message);
    }
    case 'start-topic': {
      if (state.exam?.status === 'active') return state;
      const topic = TOPICS.find(item => item.id === action.topicId);
      if (!topic) return state;
      const settings = normalizeSettings({ ...state.settings, mode: 'training', compType: topic.compType, focusRule: topic.rule });
      const topicSession = { topicId: topic.id, phase: 'mini', seed: Number(action.seed ?? Number(current.exercise.seed) + 1), miniIndex: 0, minisInCycle: 0, answered: false, lastAnswer: null, lastCorrect: null, cycles: 0 };
      const history = historyWithAbandoned(state, now);
      return { ...state, settings, exam: null, topicSession, topicProgress: state.topicProgress || createTopicProgress(), history };
    }
    case 'topic-answer': {
      const topicSession = state.topicSession;
      if (!topicSession || topicSession.phase !== 'mini' || topicSession.answered || !['yes', 'no'].includes(action.answer)) return state;
      const topic = TOPICS.find(item => item.id === topicSession.topicId);
      if (!topic) return report(state, 'El tema guardado no se pudo verificar.', 'error');
      let mini;
      try { mini = createMiniExercise(topic.id, topicSession.seed, topicSession.miniIndex, state.settings); }
      catch { return report(state, 'El mini ejercicio no superó la verificación y no se registró una respuesta.', 'error'); }
      const correct = mini.answer === action.answer;
      const counts = state.topicProgress[topic.id] || { minis: 0, miniCorrect: 0, miniErrors: 0, circuits: 0, circuitErrors: 0 };
      return { ...state, progress: correct ? state.progress : { ...state.progress, streak: 0 }, topicProgress: { ...state.topicProgress, [topic.id]: { ...counts, minis: counts.minis + 1, miniCorrect: counts.miniCorrect + Number(correct), miniErrors: counts.miniErrors + Number(!correct) } }, topicSession: { ...topicSession, answered: true, minisInCycle: topicSession.minisInCycle + 1, lastAnswer: action.answer, lastCorrect: correct } };
    }
    case 'continue-topic': {
      const topicSession = state.topicSession;
      if (!topicSession || topicSession.phase !== 'mini' || !topicSession.answered) return state;
      if (topicSession.minisInCycle < 2) return { ...state, topicSession: { ...topicSession, miniIndex: topicSession.miniIndex + 1, answered: false, lastAnswer: null, lastCorrect: null } };
      const topic = TOPICS.find(item => item.id === topicSession.topicId);
      if (!topic) return state;
      const nextSession = { ...topicSession, phase: 'circuit', answered: false, lastAnswer: null, lastCorrect: null };
      return spawn({ ...state, topicSession: nextSession }, Number(action.seed ?? topicSession.seed + topicSession.cycles + 1), now);
    }
    case 'settings': {
      if (state.exam?.status === 'active') return state;
      const settings = normalizeSettings({ ...state.settings, ...action.settings });
      const visualOnly = Object.keys(action.settings).every(key => ['flow', 'resistorStyle', 'theme'].includes(key));
      if (visualOnly) return record({ ...state, settings }, { kind: 'configuration', settings: action.settings }, now);
      if (state.topicSession?.phase === 'mini' && Object.keys(action.settings).every(key => key === 'difficulty')) {
        return record({ ...state, settings }, { kind: 'configuration', settings: action.settings }, now);
      }
      const recorded = record(state, { kind: 'configuration', settings: action.settings }, now);
      const topic = TOPICS.find(item => item.id === state.topicSession?.topicId);
      const topicSession = state.topicSession && settings.mode === 'training' && settings.compType === topic?.compType && settings.focusRule === topic?.rule ? state.topicSession : null;
      return spawn({ ...recorded, settings, topicSession, exam: null, history: historyWithAbandoned(recorded, now) }, seed, now);
    }
    case 'new':
      if (state.exam?.status === 'active') return state;
      if (state.topicSession?.phase === 'mini') return spawn({ ...state, settings: normalizeSettings({ ...state.settings, focusRule: null }), topicSession: null, history: historyWithAbandoned(state, now), exam: null }, seed, now);
      return spawn({ ...state, history: historyWithAbandoned(state, now), exam: null }, seed, now);
    case 'next':
      if (!current.submitted || state.settings.mode === 'exam') return state;
      if (state.topicSession?.phase === 'circuit') return { ...state, topicSession: { ...state.topicSession, phase: 'mini', miniIndex: state.topicSession.miniIndex + 1, minisInCycle: 0, answered: false, lastAnswer: null, lastCorrect: null, cycles: state.topicSession.cycles + 1 } };
      return spawn(state, seed, now);
    case 'exit-topic': {
      if (!state.topicSession || state.exam?.status === 'active') return state;
      const settings = normalizeSettings({ ...state.settings, focusRule: null, mode: 'training' });
      const history = historyWithAbandoned(state, now);
      return spawn({ ...state, settings, topicSession: null, exam: null, history }, seed, now);
    }
    case 'repeat': {
      if (state.exam?.status === 'active' || !validHistoryItem(action.item) || !action.item.initial || !action.item.settings || !Number.isFinite(action.item.seed)) return state;
      const exerciseSettings = normalizeSettings({ ...action.item.settings, mode: 'training' });
      const settings = normalizeSettings({ ...exerciseSettings, focusRule: null });
      const exercise = generateExercise(exerciseSettings, action.item.seed, []);
      exercise.id = `${action.item.id}:repeat:${state.history.length}:${now}`;
      const key = recentKey(exerciseSettings), recent = [...(state.recent[key] || []), exercise.signature].slice(-20);
      const history = historyWithAbandoned(state, now);
      return { ...state, settings, topicSession: null, exam: null, recent: { ...state.recent, [key]: recent }, current: currentExercise(exercise, now, false), history };
    }
    case 'start-exam': {
      if (state.exam?.status === 'active') return state;
      const settings = normalizeSettings({ ...state.settings, mode: 'exam', focusRule: null });
      return spawn({ ...state, settings, topicSession: null, exam: { status: 'active', count: state.settings.examCount, startedAt: now, deadline: state.settings.examMinutes ? now + state.settings.examMinutes * 60000 : null, results: [] } }, seed, now);
    }
    case 'finish-exam': {
      if (state.exam?.status !== 'active') return state;
      return expire({ ...state, exam: { ...state.exam, deadline: now } }, now);
    }
    case 'submit': {
      if (locked || !isComplete(current.exercise)) return state;
      const reward = current.rewardEligible === false ? null : calculateReward(state.progress, state.settings.difficulty, current.attempts.some(item => item.kind === 'error'));
      const item = resultRecord(state, now, 'complete', reward);
      if (current.rewardEligible !== false && state.history.some(entry => entry.id === item.id && entry.status === 'complete' && !entry.repeat)) return state;
      const next = { ...state, progress: reward ? applyReward(state.progress, reward) : state.progress, history: [...state.history, item].slice(-200), current: { ...current, submitted: true, selected: [], pending: null } };
      if (state.topicSession?.phase === 'circuit') {
        const counts = state.topicProgress[state.topicSession.topicId];
        next.topicProgress = { ...state.topicProgress, [state.topicSession.topicId]: { ...counts, circuits: counts.circuits + 1 } };
      }
      if (state.exam?.status === 'active') {
        next.exam = { ...state.exam, results: [...state.exam.results, item] };
        if (next.exam.results.length === next.exam.count) { next.exam.status = 'finished'; return next; }
        return spawn(next, seed, now);
      }
      return next;
    }
    default: return state;
  }
}
function validStoredValue(value) {
  return isExactValue(value);
}
function validExercise(exercise) {
  if (!exercise || !Array.isArray(exercise.edges) || !exercise.edges.length || exercise.edges.length > 30 || !Array.isArray(exercise.nodes) || exercise.nodes.length > 60 || !exercise.settings || !Array.isArray(exercise.buses) || !Array.isArray(exercise.sourceRoute) || exercise.sourceRoute.length < 2 || !exercise.bounds || !Number.isFinite(exercise.bounds.width) || !Number.isFinite(exercise.bounds.height) || exercise.bounds.width < 1 || exercise.bounds.height < 1 || !Number.isInteger(exercise.revision) || exercise.revision < 0) return false;
  if (!exercise.sourceRoute.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return false;
  const nodeIds = new Set(exercise.nodes.map(node => node.id));
  if (!nodeIds.has('A') || !nodeIds.has('B') || exercise.nodes.some(node => !Number.isFinite(node.x) || !Number.isFinite(node.y))) return false;
  if (exercise.buses.some(bus => !nodeIds.has(bus.id) || !['x', 'y'].includes(bus.axis) || !Number.isFinite(bus[bus.axis === 'x' ? 'y' : 'x']))) return false;
  const ids = new Set(exercise.edges.map(edge => edge.id));
  if (ids.size !== exercise.edges.length) return false;
  for (const edge of exercise.edges) {
    if (!validStoredValue(edge.value)) return false;
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || typeof edge.label !== 'string' || !Array.isArray(edge.route) || edge.route.length < 2 || edge.route.length > 100 || !edge.route.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return false;
  }
  return inspectExercise(exercise).valid;
}
function validAttempt(item) {
  if (!item || typeof item !== 'object' || typeof item.kind !== 'string') return false;
  if (item.kind === 'error') return typeof item.message === 'string';
  if (item.kind === 'reduction') return Array.isArray(item.components) && item.components.length > 0 && item.components.every(component => component && typeof component.label === 'string' && validStoredValue(component.value)) && (item.equivalent == null || typeof item.equivalent.label === 'string' && validStoredValue(item.equivalent.value));
  if (item.kind === 'configuration') return item.settings && typeof item.settings === 'object';
  return ['undo', 'redo', 'hint'].includes(item.kind);
}
function validHistoricalExercise(exercise) {
  return !exercise || Boolean(exercise && Array.isArray(exercise.edges) && exercise.edges.length > 0 && exercise.edges.length <= 30 && exercise.edges.every(edge => edge && validStoredValue(edge.value)));
}
function validHistoryItem(item) {
  return Boolean(item && typeof item.id === 'string' && ['complete', 'incomplete', 'abandoned'].includes(item.status) && (item.topicId == null || TOPICS.some(topic => topic.id === item.topicId)) && (item.repeat == null || typeof item.repeat === 'boolean') && ['steps', 'errors', 'undos', 'elapsed'].every(key => Number.isFinite(item[key]) && item[key] >= 0) && Array.isArray(item.attempts) && item.attempts.length <= 1000 && item.attempts.every(validAttempt) && (item.settings == null || typeof item.settings === 'object') && validHistoricalExercise(item.initial) && validHistoricalExercise(item.final) && (item.reward == null || Number.isFinite(item.reward.points) && item.reward.points >= 0));
}
function validSession(saved) {
  if (!saved || saved.version !== 2 || !validExercise(saved.current?.exercise)) return false;
  const current = saved.current, edgeIds = new Set(current.exercise.edges.map(edge => edge.id));
  if (!Array.isArray(current.past) || current.past.length > 30 || !current.past.every(validExercise) || !Array.isArray(current.future) || current.future.length > 30 || !current.future.every(validExercise)) return false;
  if (!Array.isArray(current.attempts) || current.attempts.length > 1000 || !current.attempts.every(validAttempt) || !Array.isArray(current.selected) || new Set(current.selected).size !== current.selected.length || current.selected.some(id => !edgeIds.has(id))) return false;
  if (!Number.isFinite(current.startedAt) || typeof current.submitted !== 'boolean' || current.notice != null && (typeof current.notice.message !== 'string' || typeof current.notice.kind !== 'string')) return false;
  if (current.pending != null && (!Array.isArray(current.pending.ids) || current.pending.ids.length < 2 || current.pending.ids.some(id => !edgeIds.has(id)) || !['series', 'parallel'].includes(current.pending.rule) || current.pending.revision !== current.exercise.revision || !validStoredValue(current.pending.value))) return false;
  if (current.pending != null) {
    if (!saved.settings?.manual) return false;
    const verified = prepareReduction(current.exercise, current.pending.ids, current.pending.rule);
    if (!verified.valid || JSON.stringify(verified.value) !== JSON.stringify(current.pending.value)) return false;
  }
  if (!Array.isArray(saved.history) || saved.history.length > 200 || !saved.history.every(validHistoryItem) || !saved.recent || typeof saved.recent !== 'object' || Object.values(saved.recent).some(items => !Array.isArray(items) || items.length > 20 || items.some(signature => typeof signature !== 'string'))) return false;
  if (saved.topicProgress != null && !validateTopicProgress(saved.topicProgress)) return false;
  if (saved.topicSession != null) {
    if (!validateTopicSession(saved.topicSession)) return false;
    const topic = TOPICS.find(item => item.id === saved.topicSession.topicId);
    if (saved.settings?.mode !== 'training' || saved.settings?.compType !== topic.compType || saved.settings?.focusRule !== topic.rule) return false;
    if (saved.topicSession.phase === 'circuit' && saved.current.exercise.tree?.type !== topic.rule) return false;
  }
  if (saved.exam == null) return true;
  const exam = saved.exam;
  if (!['active', 'finished'].includes(exam.status) || ![3, 5, 10].includes(exam.count) || !Number.isFinite(exam.startedAt) || !(exam.deadline == null || Number.isFinite(exam.deadline)) || !Array.isArray(exam.results) || exam.results.length > exam.count || !exam.results.every(validHistoryItem) || saved.settings?.mode !== 'exam' || exam.count !== saved.settings.examCount) return false;
  return exam.status === 'active' ? exam.results.length < exam.count : exam.results.length === exam.count;
}
export function loadSession({ storage, qa, now = Date.now() } = {}) {
  let warning = null, progress;
  try {
    storage ??= globalThis.localStorage;
    progress = normalizeProgress(JSON.parse(storage?.getItem(PROGRESS_KEY) || '{}'));
    const raw = storage?.getItem(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const matchesQa = !qa?.enabled || !qa.explicit || saved.qaKey === qa.key;
      if (matchesQa) {
        if (!validSession(saved)) throw new Error('Sesión dañada');
        saved.settings = normalizeSettings(saved.settings); saved.progress = normalizeProgress(saved.progress);
        saved.current.rewardEligible ??= true;
        saved.topicProgress ??= createTopicProgress(); saved.topicSession ??= null;
        return { state: sessionReducer(saved, { type: 'tick', now }), warning };
      }
    }
  } catch { warning = 'No se pudo recuperar la sesión guardada. Podés practicar; el progreso anterior se conserva cuando está disponible.'; }
  const settings = qa?.enabled ? qa : undefined;
  return { state: createSession({ settings, progress, seed: qa?.enabled ? qa.seed : now, qaKey: qa?.enabled && qa.explicit ? qa.key : null, now }), warning };
}
export function saveSession(state, storage) {
  try {
    storage ??= globalThis.localStorage;
    // Numeric Infinity is legacy interoperability only. Recreate it from the explicit value tag.
    storage.setItem(SESSION_KEY, JSON.stringify(state, (key, value) => key === 'val' && !Number.isFinite(value) ? undefined : value));
    storage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    return true;
  } catch { return false; }
}
